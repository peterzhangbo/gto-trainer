use crate::config::ScenarioConfig;
use crate::solver::SolverResult;
use anyhow::Result;
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;

/// The JSON structure exported to the frontend.
#[derive(Serialize, Debug)]
pub struct FrontendData {
    /// Scenario identifier (e.g. "cbet_dry_high_ip").
    pub scenario: String,

    /// Hero's position.
    pub position: String,

    /// Effective stack depth in big blinds.
    pub stack_depth: f64,

    /// Board cards, if postflop.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub board: Option<Vec<String>>,

    /// Board texture label.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub board_texture: Option<String>,

    /// Solver metadata.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub solver_meta: Option<FrontendSolverMeta>,

    /// Map from hand notation to action frequencies.
    /// e.g. {"AKs": {"raise": 0.85, "fold": 0.15}, "TT": {"call": 1.0}}
    pub hands: HashMap<String, HashMap<String, f64>>,

    /// Map from hand notation to EV, if requested.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ev: Option<HashMap<String, f64>>,

    /// Map from hand notation to equity, if requested.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub equity: Option<HashMap<String, f64>>,

    /// Strategy data organized for grid display (13x13 matrix).
    /// Keys are hand notation, values are the primary action and its frequency.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strategy: Option<HashMap<String, HandStrategy>>,

    /// Hand classification for coloring (e.g. "raise", "call", "fold").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hand_classification: Option<HashMap<String, String>>,
}

#[derive(Serialize, Debug)]
pub struct FrontendSolverMeta {
    pub iterations: u32,
    pub exploitability: f64,
    pub compute_time_secs: f64,
}

#[derive(Serialize, Debug)]
pub struct HandStrategy {
    /// The primary action for this hand.
    pub action: String,
    /// Frequency of the primary action (0.0 to 1.0).
    pub frequency: f64,
    /// All action frequencies for this hand.
    pub all_actions: HashMap<String, f64>,
}

/// Export solver results to the frontend JSON format.
pub fn export_results(
    config: &ScenarioConfig,
    result: &SolverResult,
    output_path: &Path,
) -> Result<()> {
    let frontend_data = build_frontend_data(config, result)?;

    let json = serde_json::to_string_pretty(&frontend_data)?;

    // Ensure the output directory exists
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    std::fs::write(output_path, &json)?;
    eprintln!("Exported results to {}", output_path.display());

    Ok(())
}

fn build_frontend_data(config: &ScenarioConfig, result: &SolverResult) -> Result<FrontendData> {
    let scenario_name = build_scenario_name(config);

    // Build the strategy grid and hand classification
    let (strategy, hand_classification) = build_strategy_grid(&result.hand_strategies, config);

    let solver_meta = Some(FrontendSolverMeta {
        iterations: result.meta.iterations,
        exploitability: result.meta.exploitability,
        compute_time_secs: result.meta.compute_time_secs,
    });

    Ok(FrontendData {
        scenario: scenario_name,
        position: config.scenario.position.clone(),
        stack_depth: config.scenario.stack_depth,
        board: config.scenario.board.clone(),
        board_texture: config.scenario.board_texture.clone(),
        solver_meta,
        hands: result.hand_strategies.clone(),
        ev: if config.output.include_ev {
            result.hand_ev.clone()
        } else {
            None
        },
        equity: result.hand_equity.clone(),
        strategy: Some(strategy),
        hand_classification: Some(hand_classification),
    })
}

/// Build a human-readable scenario name from the config.
fn build_scenario_name(config: &ScenarioConfig) -> String {
    let base = match config.scenario.scenario_type.as_str() {
        "rfi" => format!("rfi_{}_{}bb", config.scenario.position.to_lowercase(), config.scenario.stack_depth as u32),
        "3bet" => {
            let villain = config.scenario.villain_position.as_deref().unwrap_or("??");
            format!("3bet_{}_vs_{}_{}bb",
                config.scenario.position.to_lowercase(),
                villain.to_lowercase(),
                config.scenario.stack_depth as u32
            )
        }
        "c-bet" | "single-raised" => {
            let texture = config.scenario.board_texture.as_deref().unwrap_or("unknown");
            format!("cbet_{}_{}_{}",
                config.scenario.position.to_lowercase(),
                texture,
                config.scenario.stack_depth as u32
            )
        }
        other => format!("{}_{}bb", other, config.scenario.stack_depth as u32),
    };
    base
}

/// Build the strategy grid and classification for frontend display.
fn build_strategy_grid(
    hand_strategies: &HashMap<String, HashMap<String, f64>>,
    config: &ScenarioConfig,
) -> (HashMap<String, HandStrategy>, HashMap<String, String>) {
    let mut strategy_map: HashMap<String, HandStrategy> = HashMap::new();
    let mut classification_map: HashMap<String, String> = HashMap::new();

    for (hand, actions) in hand_strategies {
        if actions.is_empty() {
            continue;
        }

        // Find the primary action (highest frequency)
        let (primary_action, primary_freq) = actions
            .iter()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
            .map(|(k, v)| (k.clone(), *v))
            .unwrap_or_else(|| ("fold".to_string(), 1.0));

        strategy_map.insert(
            hand.clone(),
            HandStrategy {
                action: primary_action.clone(),
                frequency: primary_freq,
                all_actions: actions.clone(),
            },
        );

        // Classify the hand based on its primary action
        let classification = classify_action(&primary_action, config);
        classification_map.insert(hand.clone(), classification);
    }

    (strategy_map, classification_map)
}

/// Map an action name to a classification category for frontend coloring.
fn classify_action(action: &str, _config: &ScenarioConfig) -> String {
    if action.starts_with("bet") || action.starts_with("raise") || action == "all_in" {
        "raise".to_string()
    } else if action == "call" || action == "check" {
        "call".to_string()
    } else if action == "fold" {
        "fold".to_string()
    } else {
        action.to_string()
    }
}
