use crate::config::ScenarioConfig;
use anyhow::Result;
use postflop_solver::*;
use std::collections::HashMap;
use std::time::Instant;

/// Result from running the solver on a scenario.
#[derive(Debug, Clone)]
pub struct SolverResult {
    /// Map from hand notation (e.g. "AKs") to action frequencies.
    /// Each inner map is action_name -> frequency (0.0 to 1.0).
    pub hand_strategies: HashMap<String, HashMap<String, f64>>,

    /// Map from hand notation to expected value.
    pub hand_ev: Option<HashMap<String, f64>>,

    /// Map from hand notation to equity.
    pub hand_equity: Option<HashMap<String, f64>>,

    /// Solver metadata.
    pub meta: SolverMeta,
}

/// Metadata about the solve.
#[derive(Debug, Clone)]
pub struct SolverMeta {
    pub iterations: u32,
    pub exploitability: f64,
    pub compute_time_secs: f64,
}

/// Solve a postflop scenario using the postflop-solver crate.
///
/// # Preflop Limitation
///
/// The `postflop-solver` crate only supports postflop game trees (flop/turn/river).
/// Preflop scenarios (RFI, 3bet) cannot be solved directly. For preflop scenarios,
/// this function returns an error with guidance on how to proceed. To solve preflop
/// ranges, you would need a dedicated preflop solver or a different approach
/// (e.g., using a simplified toy game abstraction).
pub fn solve_scenario(config: &ScenarioConfig) -> Result<SolverResult> {
    if config.is_preflop() {
        return Err(anyhow::anyhow!(
            "Preflop scenarios (type '{}') are not supported by the postflop-solver crate. \
             The postflop-solver only handles flop/turn/river game trees.\n\n\
             To generate preflop ranges, consider:\n\
             1. Using a dedicated preflop solver (e.g., PioSOLVER preflop, SimplePostflop)\n\
             2. Using a simplified toy game model\n\
             3. Using pre-computed GTO charts\n\n\
             For postflop scenarios, provide board cards in the TOML config.",
            config.scenario.scenario_type
        ));
    }

    let board = config.scenario.board.as_ref().unwrap();
    let start = Instant::now();

    // Parse ranges
    let oop_range_str = get_oop_range(config)?;
    let ip_range_str = get_ip_range(config)?;

    let oop_range: Range = oop_range_str.parse().map_err(|e| {
        anyhow::anyhow!("Failed to parse OOP range '{}': {:?}", oop_range_str, e)
    })?;
    let ip_range: Range = ip_range_str.parse().map_err(|e| {
        anyhow::anyhow!("Failed to parse IP range '{}': {:?}", ip_range_str, e)
    })?;

    // Parse board cards
    let flop_cards = parse_flop(board)?;
    let turn_card = if board.len() >= 4 {
        card_from_str(&board[3]).map_err(|e| anyhow::anyhow!("Invalid turn card '{}': {:?}", board[3], e))?
    } else {
        NOT_DEALT
    };
    let river_card = if board.len() >= 5 {
        card_from_str(&board[4]).map_err(|e| anyhow::anyhow!("Invalid river card '{}': {:?}", board[4], e))?
    } else {
        NOT_DEALT
    };

    let card_config = CardConfig {
        range: [oop_range, ip_range],
        flop: flop_cards,
        turn: turn_card,
        river: river_card,
    };

    // Determine starting state based on how many board cards are provided
    let initial_state = match board.len() {
        3 => BoardState::Flop,
        4 => BoardState::Turn,
        5 => BoardState::River,
        _ => return Err(anyhow::anyhow!(
            "Invalid number of board cards: {}. Expected 3 (flop), 4 (turn), or 5 (river).",
            board.len()
        )),
    };

    // Configure bet sizes
    let bet_size_str = config.scenario.bet_sizes.as_deref().unwrap_or("50%, 75%, 100%, a");
    let raise_size_str = config.scenario.raise_sizes.as_deref().unwrap_or("2.5x");

    let bet_sizes = BetSizeOptions::try_from((bet_size_str, raise_size_str))
        .map_err(|e| anyhow::anyhow!("Failed to parse bet sizes '{}': {:?}", bet_size_str, e))?;

    let starting_pot = (config.effective_starting_pot() * 100.0) as i32; // convert BB to chips (1BB = 100 chips)
    let effective_stack = (config.scenario.stack_depth * 100.0) as i32;

    let tree_config = TreeConfig {
        initial_state,
        starting_pot,
        effective_stack,
        rake_rate: 0.0,
        rake_cap: 0.0,
        flop_bet_sizes: [bet_sizes.clone(), bet_sizes.clone()],
        turn_bet_sizes: [bet_sizes.clone(), bet_sizes.clone()],
        river_bet_sizes: [bet_sizes.clone(), bet_sizes],
        turn_donk_sizes: None,
        river_donk_sizes: None,
        add_allin_threshold: 1.5,
        force_allin_threshold: 0.15,
        merging_threshold: 0.1,
    };

    let action_tree = ActionTree::new(tree_config)
        .map_err(|e| anyhow::anyhow!("Failed to create action tree: {:?}", e))?;

    let mut game = PostFlopGame::with_config(card_config, action_tree)
        .map_err(|e| anyhow::anyhow!("Failed to create game: {:?}", e))?;

    // Check memory and allocate
    let (mem_usage, _mem_compressed) = game.memory_usage();
    eprintln!("Memory usage: {:.2} GB", mem_usage as f64 / (1024.0 * 1024.0 * 1024.0));

    game.allocate_memory(false); // false = 32-bit float (full precision)

    // Run the solver
    let max_iterations = config.solver.max_iterations;
    let target_exploitability = starting_pot as f32 * (config.solver.target_exploitability / 100.0) as f32;

    eprintln!(
        "Running solver: {} iterations, target exploitability {:.2}...",
        max_iterations, target_exploitability
    );

    let exploitability = solve(&mut game, max_iterations, target_exploitability, true);
    let iterations_run = max_iterations; // solve() runs until one of the conditions is met

    let compute_time = start.elapsed().as_secs_f64();
    eprintln!(
        "Solver finished: exploitability={:.2}, time={:.1}s",
        exploitability, compute_time
    );

    // Extract results
    // First, navigate the tree to extract strategy at the root decision point.
    // This needs &mut game, so do it before borrowing game immutably for weights.
    let hand_strategies = extract_root_strategy(&mut game)?;

    // Now compute equity, EV, and weights (immutable borrows)
    game.cache_normalized_weights();

    let equity = game.equity(0);  // OOP equity
    let ev = game.expected_values(0);  // OOP EV
    let weights = game.normalized_weights(0);
    let avg_equity = compute_average(&equity, weights);
    let avg_ev = compute_average(&ev, weights);

    eprintln!("Average OOP equity: {:.4}, Average OOP EV: {:.2}", avg_equity, avg_ev);

    // Build per-hand EV and equity maps
    let oop_cards = game.private_cards(0);
    let hand_ev = build_hand_value_map(oop_cards, &ev, weights);
    let hand_equity = build_hand_value_map(oop_cards, &equity, weights);

    Ok(SolverResult {
        hand_strategies,
        hand_ev: Some(hand_ev),
        hand_equity: Some(hand_equity),
        meta: SolverMeta {
            iterations: iterations_run,
            exploitability: exploitability as f64,
            compute_time_secs: compute_time,
        },
    })
}

/// Navigate to the root decision node and extract the strategy for each hand.
fn extract_root_strategy(game: &mut PostFlopGame) -> Result<HashMap<String, HashMap<String, f64>>> {
    let actions = game.available_actions();
    let action_names = actions_to_names(&actions);
    let oop_cards = game.private_cards(0);

    // If we're at a chance node (e.g., turn/river not dealt yet), we need to handle it
    // For a flop-only solve, we should already be at a decision node after the flop is dealt.
    // The solver's tree structure puts the first decision node right after the initial deal.

    let strategy = game.strategy();
    let num_hands = oop_cards.len();

    let mut hand_strategies: HashMap<String, HashMap<String, f64>> = HashMap::new();

    for i in 0..num_hands {
        let hole = oop_cards[i];
        let hand_notation = hole_to_hand_notation(hole);

        let mut action_map: HashMap<String, f64> = HashMap::new();
        for (a_idx, action_name) in action_names.iter().enumerate() {
            // Strategy layout: strategy[action_index * num_hands + hand_index]
            let freq = strategy[a_idx * num_hands + i] as f64;
            if freq > 0.001 {
                // Only include actions with meaningful frequency
                action_map.insert(action_name.clone(), (freq * 1000.0).round() / 1000.0);
            }
        }

        hand_strategies.insert(hand_notation, action_map);
    }

    Ok(hand_strategies)
}

/// Convert postflop-solver Action enum to human-readable names.
fn actions_to_names(actions: &[Action]) -> Vec<String> {
    actions
        .iter()
        .map(|a| match a {
            Action::Fold => "fold".to_string(),
            Action::Check => "check".to_string(),
            Action::Call => "call".to_string(),
            Action::Bet(size) => format!("bet_{}", size),
            Action::Raise(size) => format!("raise_{}", size),
            Action::AllIn(size) => format!("allin_{}", size),
            _ => "unknown".to_string(),
        })
        .collect()
}

/// Convert a hole card pair to standard hand notation.
/// Cards use the encoding: rank = card / 4, suit = card % 4,
/// where rank 0=2, 1=3, ..., 8=T, 9=J, 10=Q, 11=K, 12=A.
///
/// e.g., (Card for Ah, Card for Kh) -> "AKs"
///       (Card for Ac, Card for Kd) -> "AKo"
///       (Card for Th, Card for Tc) -> "TT"
fn hole_to_hand_notation(hole: (Card, Card)) -> String {
    let (c0, c1) = hole;
    let rank0 = card_rank(c0);
    let rank1 = card_rank(c1);
    let suit0 = card_suit(c0);
    let suit1 = card_suit(c1);

    let suited = suit0 == suit1;

    // Ensure higher rank first
    let (high_rank, low_rank) = if rank0 >= rank1 {
        (rank0, rank1)
    } else {
        (rank1, rank0)
    };

    let high_str = rank_to_char(high_rank);
    let low_str = rank_to_char(low_rank);

    if high_rank == low_rank {
        // Pocket pair
        format!("{}{}", high_str, low_str)
    } else if suited {
        format!("{}{}s", high_str, low_str)
    } else {
        format!("{}{}o", high_str, low_str)
    }
}

fn card_rank(card: u8) -> u8 {
    card / 4
}

fn card_suit(card: u8) -> u8 {
    card % 4
}

fn rank_to_char(rank: u8) -> &'static str {
    match rank {
        0 => "2",
        1 => "3",
        2 => "4",
        3 => "5",
        4 => "6",
        5 => "7",
        6 => "8",
        7 => "9",
        8 => "T",
        9 => "J",
        10 => "Q",
        11 => "K",
        12 => "A",
        _ => "?",
    }
}

/// Build a map from hand notation to a weighted average value (EV or equity).
fn build_hand_value_map(
    private_cards: &[(Card, Card)],
    values: &[f32],
    weights: &[f32],
) -> HashMap<String, f64> {
    let mut value_sums: HashMap<String, (f64, f64)> = HashMap::new();

    for (i, &hole) in private_cards.iter().enumerate() {
        let notation = hole_to_hand_notation(hole);
        let w = weights[i] as f64;
        let v = values[i] as f64;

        let entry = value_sums.entry(notation).or_insert((0.0, 0.0));
        entry.0 += v * w;
        entry.1 += w;
    }

    value_sums
        .into_iter()
        .filter_map(|(hand, (sum, weight))| {
            if weight > 0.0 {
                Some((hand, sum / weight))
            } else {
                None
            }
        })
        .collect()
}

/// Get the OOP (out of position) range string based on the scenario.
/// For most postflop scenarios, the OOP player is the preflop caller or the BB.
fn get_oop_range(config: &ScenarioConfig) -> Result<String> {
    // Default ranges for common scenarios
    match config.scenario.scenario_type.as_str() {
        "c-bet" | "single-raised" => {
            // In a single raised pot, the caller is OOP (typically BB defending)
            match config.scenario.position.as_str() {
                // Hero is IP, villain is OOP (BB defending range)
                "BTN" | "CO" | "HJ" | "UTG" => {
                    Ok(get_default_bb_defending_range())
                }
                // Hero is OOP (SB or BB)
                "SB" | "BB" => {
                    Ok(get_default_bb_defending_range())
                }
                _ => Err(anyhow::anyhow!("Unknown position: {}", config.scenario.position)),
            }
        }
        "3bet" => {
            // In a 3bet pot, the 3bettor is OOP (or IP depending on positions)
            Ok(get_default_3bet_calling_range())
        }
        _ => Ok(get_default_bb_defending_range()),
    }
}

/// Get the IP (in position) range string based on the scenario.
fn get_ip_range(config: &ScenarioConfig) -> Result<String> {
    match config.scenario.scenario_type.as_str() {
        "c-bet" | "single-raised" => {
            // The raiser is IP
            match config.scenario.position.as_str() {
                "BTN" => Ok(get_default_btn_open_range()),
                "CO" => Ok(get_default_co_open_range()),
                "HJ" => Ok(get_default_hj_open_range()),
                "UTG" => Ok(get_default_utg_open_range()),
                "SB" | "BB" => Ok(get_default_btn_open_range()),
                _ => Err(anyhow::anyhow!("Unknown position: {}", config.scenario.position)),
            }
        }
        "3bet" => {
            Ok(get_default_3bet_range())
        }
        _ => Ok(get_default_btn_open_range()),
    }
}

// --- Default range strings (approximate GTO ranges) ---

fn get_default_btn_open_range() -> String {
    "22+,A2s+,A9o+,K2s+,K9o+,Q2s+,Q9o+,J8s+,J9o+,T8s+,T9o+,97s+,87s,76s,65s,54s".to_string()
}

fn get_default_co_open_range() -> String {
    "22+,A2s+,ATo+,K5s+,KTo+,Q8s+,QTo+,J8s+,JTo+,T8s+,98s,87s,76s,65s".to_string()
}

fn get_default_hj_open_range() -> String {
    "33+,A5s+,A9o+,K8s+,KTo+,Q9s+,QTo+,J9s+,T9s,98s,87s,76s".to_string()
}

fn get_default_utg_open_range() -> String {
    "44+,A9s+,AJo+,KTs+,KQo,QTs+,JTs,T9s,98s".to_string()
}

fn get_default_bb_defending_range() -> String {
    "22+,A2s+,A2o+,K2s+,K5o+,Q2s+,Q7o+,J2s+,J8o+,T6s+,T8o+,96s+,98o,85s+,87o,75s+,76o,65s,54s".to_string()
}

fn get_default_3bet_range() -> String {
    "QQ+,AKs,AKo".to_string()
}

fn get_default_3bet_calling_range() -> String {
    "JJ-22,AQs-A8s,AQo-AJo,KJs+,KQo,QJs,JTs".to_string()
}

/// Parse board cards from string vector (e.g. ["Td", "9d", "6h"]) into a flop array.
fn parse_flop(board: &[String]) -> Result<[Card; 3]> {
    if board.len() < 3 {
        return Err(anyhow::anyhow!(
            "Board must have at least 3 cards (flop), got {}",
            board.len()
        ));
    }

    let flop_str = format!("{} {} {}", board[0], board[1], board[2]);
    flop_from_str(&flop_str).map_err(|e| anyhow::anyhow!("Failed to parse flop '{}': {:?}", flop_str, e))
}
