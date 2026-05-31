use serde::Deserialize;
use std::path::Path;

/// Top-level scenario configuration loaded from a TOML file.
#[derive(Deserialize, Debug, Clone)]
pub struct ScenarioConfig {
    pub scenario: ScenarioDef,
    pub solver: SolverConfig,
    pub output: OutputConfig,
}

/// Defines the poker scenario to solve.
#[derive(Deserialize, Debug, Clone)]
pub struct ScenarioDef {
    /// Scenario type: "rfi", "3bet", "c-bet", "single-raised", etc.
    pub scenario_type: String,

    /// Hero's position (e.g. "UTG", "HJ", "CO", "BTN", "SB", "BB").
    pub position: String,

    /// Effective stack depth in big blinds.
    pub stack_depth: f64,

    /// Whether antes are in play.
    #[serde(default)]
    pub ante: bool,

    /// Villain's position (for heads-up scenarios like 3bet pots).
    pub villain_position: Option<String>,

    /// Board cards in string notation, e.g. ["Td", "9d", "6h"] for the flop.
    /// Required for postflop scenarios.
    pub board: Option<Vec<String>>,

    /// Board texture label for export metadata (e.g. "dry-high", "wet-connected").
    pub board_texture: Option<String>,

    /// Starting pot in big blinds (auto-calculated if not provided).
    pub starting_pot: Option<f64>,

    /// Bet sizes for each street as a string (e.g. "50%, 75%, 100%").
    /// Applies to flop, turn, river unless overridden.
    pub bet_sizes: Option<String>,

    /// Raise sizes (e.g. "2.5x", "3x").
    pub raise_sizes: Option<String>,
}

/// Solver engine configuration.
#[derive(Deserialize, Debug, Clone)]
pub struct SolverConfig {
    /// Maximum number of CFR iterations to run.
    pub max_iterations: u32,

    /// Target exploitability as a fraction of the pot (e.g. 0.5 = 0.5% of pot).
    pub target_exploitability: f64,

    /// Number of threads for parallel solving.
    #[serde(default = "default_threads")]
    pub num_threads: u32,
}

fn default_threads() -> u32 {
    4
}

/// Output format configuration.
#[derive(Deserialize, Debug, Clone)]
pub struct OutputConfig {
    /// Output format: "frontend-json".
    pub format: String,

    /// Whether to include EV values in the output.
    #[serde(default)]
    pub include_ev: bool,

    /// Which actions to include in the output (e.g. ["raise", "call", "fold"]).
    #[serde(default)]
    pub include_actions: Vec<String>,
}

impl ScenarioConfig {
    /// Load a scenario configuration from a TOML file.
    pub fn from_file(path: &Path) -> anyhow::Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let config: ScenarioConfig = toml::from_str(&content)?;
        Ok(config)
    }

    /// Returns true if this is a postflop scenario (board cards are specified).
    pub fn is_postflop(&self) -> bool {
        self.scenario.board.is_some() && !self.scenario.board.as_ref().unwrap().is_empty()
    }

    /// Returns true if this is a preflop scenario (no board cards).
    pub fn is_preflop(&self) -> bool {
        !self.is_postflop()
    }

    /// Compute the starting pot in big blinds based on scenario type.
    /// Returns the value from config or a sensible default.
    pub fn effective_starting_pot(&self) -> f64 {
        if let Some(pot) = self.scenario.starting_pot {
            return pot;
        }
        match self.scenario.scenario_type.as_str() {
            // RFI: hero opens to ~2.5bb, so pot is ~2.5bb + blinds
            "rfi" => {
                let blinds = if self.scenario.ante { 1.5 } else { 1.5 };
                blinds
            }
            // 3bet pot: villain 3bets to ~9bb, hero calls, pot ~19.5bb
            "3bet" => 19.5,
            // Single raised pot postflop: ~5bb
            "single-raised" | "c-bet" => 5.0,
            _ => 5.0,
        }
    }
}
