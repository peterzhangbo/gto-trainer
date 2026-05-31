mod config;
mod export;
mod solver;

use anyhow::Result;
use clap::{Parser, Subcommand};
use config::ScenarioConfig;
use std::path::PathBuf;

#[derive(Parser)]
#[command(
    name = "solver-cli",
    about = "GTO Solver CLI - Computes GTO poker strategies using postflop-solver",
    version
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Solve a single scenario from a TOML configuration file
    Solve {
        /// Path to the scenario TOML configuration file
        #[arg(short, long)]
        scenario: PathBuf,

        /// Path for the output JSON file
        #[arg(short, long)]
        output: PathBuf,
    },

    /// Batch solve all .toml scenario files in a directory
    Batch {
        /// Directory containing scenario TOML files
        #[arg(short, long)]
        scenarios: PathBuf,

        /// Directory for output JSON files
        #[arg(short, long)]
        output: PathBuf,
    },

    /// Generate a scenario template TOML file
    Template {
        /// Scenario type (rfi, 3bet, c-bet, single-raised)
        #[arg(long)]
        scenario_type: String,

        /// Position (UTG, HJ, CO, BTN, SB, BB)
        #[arg(short, long)]
        position: String,

        /// Output path for the generated TOML file
        #[arg(short, long)]
        output: PathBuf,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Solve { scenario, output } => {
            eprintln!("Loading scenario from {}", scenario.display());
            let config = ScenarioConfig::from_file(&scenario)?;

            eprintln!("Solving: {} scenario, position {}, {}bb stack",
                config.scenario.scenario_type,
                config.scenario.position,
                config.scenario.stack_depth
            );

            let result = solver::solve_scenario(&config)?;
            export::export_results(&config, &result, &output)?;

            eprintln!("Done.");
        }

        Commands::Batch { scenarios, output } => {
            eprintln!("Batch solving scenarios from {}", scenarios.display());

            std::fs::create_dir_all(&output)?;

            let entries: Vec<_> = std::fs::read_dir(&scenarios)?
                .filter_map(|e| e.ok())
                .filter(|e| {
                    e.path().extension().map_or(false, |ext| ext == "toml")
                })
                .collect();

            if entries.is_empty() {
                eprintln!("No .toml files found in {}", scenarios.display());
                return Ok(());
            }

            eprintln!("Found {} scenario files", entries.len());

            for entry in &entries {
                let path = entry.path();
                let file_stem = path.file_stem().unwrap().to_string_lossy();
                let output_path = output.join(format!("{}.json", file_stem));

                eprintln!("\n--- Solving: {} ---", file_stem);

                let config = match ScenarioConfig::from_file(&path) {
                    Ok(c) => c,
                    Err(e) => {
                        eprintln!("Failed to load {}: {}", path.display(), e);
                        continue;
                    }
                };

                match solver::solve_scenario(&config) {
                    Ok(result) => {
                        if let Err(e) = export::export_results(&config, &result, &output_path) {
                            eprintln!("Failed to export {}: {}", output_path.display(), e);
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to solve {}: {}", file_stem, e);
                    }
                }
            }

            eprintln!("\nBatch complete.");
        }

        Commands::Template {
            scenario_type,
            position,
            output,
        } => {
            let template = generate_template(&scenario_type, &position);
            std::fs::write(&output, template)?;
            eprintln!("Template written to {}", output.display());
        }
    }

    Ok(())
}

/// Generate a TOML template string for the given scenario type and position.
fn generate_template(scenario_type: &str, position: &str) -> String {
    match scenario_type {
        "rfi" => format!(
            r#"[scenario]
scenario_type = "rfi"
position = "{position}"
stack_depth = 100
ante = false

[solver]
max_iterations = 1000
target_exploitability = 0.5
num_threads = 4

[output]
format = "frontend-json"
include_ev = true
include_actions = ["raise", "fold"]
"#
        ),
        "3bet" => format!(
            r#"[scenario]
scenario_type = "3bet"
position = "{position}"
villain_position = "CO"
stack_depth = 100
ante = false

[solver]
max_iterations = 1000
target_exploitability = 0.5
num_threads = 4

[output]
format = "frontend-json"
include_ev = true
include_actions = ["3bet", "call", "fold"]
"#
        ),
        "c-bet" | "cbet" => format!(
            r#"[scenario]
scenario_type = "c-bet"
position = "{position}"
villain_position = "BB"
stack_depth = 100
ante = false
board = ["Td", "9d", "6h"]
board_texture = "dry-high"

bet_sizes = "50%, 75%, 100%, a"
raise_sizes = "2.5x"

[solver]
max_iterations = 1000
target_exploitability = 0.5
num_threads = 4

[output]
format = "frontend-json"
include_ev = true
include_actions = ["bet", "check", "fold"]
"#
        ),
        "single-raised" => format!(
            r#"[scenario]
scenario_type = "single-raised"
position = "{position}"
villain_position = "BB"
stack_depth = 100
ante = false
board = ["Ts", "7h", "2c"]
board_texture = "dry-low"

bet_sizes = "50%, 75%, 100%, a"
raise_sizes = "2.5x"

[solver]
max_iterations = 1000
target_exploitability = 0.5
num_threads = 4

[output]
format = "frontend-json"
include_ev = true
include_actions = ["bet", "check", "fold"]
"#
        ),
        _ => format!(
            r#"[scenario]
scenario_type = "{scenario_type}"
position = "{position}"
stack_depth = 100
ante = false

[solver]
max_iterations = 1000
target_exploitability = 0.5
num_threads = 4

[output]
format = "frontend-json"
include_ev = true
include_actions = ["raise", "fold"]
"#
        ),
    }
}
