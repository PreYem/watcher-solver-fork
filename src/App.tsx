import { useState } from "react";
import "./App.css";
import { OwlGrid } from "./components/OwlGrid";
import { Solver, type CellState, type RowColumnState, type RuleDescription, State } from "solved/dist/puzzles/watchers";
import { mapCoord } from "./util";

const initialState: RowColumnState<CellState> = [
  [false, false, false, false, false],
  [false, false, false, false, false],
  [false, false, false, false, false],
  [false, false, false, false, false],
  [false, false, false, false, false],
];

const worldQuestState: RowColumnState<CellState> = [
  [true, false, false, false, true],
  [false, false, true, false, false],
  [false, true, true, true, false],
  [false, false, true, false, false],
  [true, false, false, false, true],
];

const worldQuestDestState: RowColumnState<CellState> = [
  [false, false, false, false, false],
  [false, false, false, false, false],
  [false, false, true, false, false],
  [false, false, false, false, false],
  [false, false, false, false, false],
];

const initalRules: RowColumnState<RuleDescription> = [
  [undefined, undefined, undefined, undefined, undefined],
  [undefined, undefined, undefined, undefined, undefined],
  [undefined, undefined, undefined, undefined, undefined],
  [undefined, undefined, undefined, undefined, undefined],
  [undefined, undefined, undefined, undefined, undefined],
];

const worldQuestRules = initalRules.map((e) => e.slice()) as RowColumnState<RuleDescription>;

function modulus(num: number, modulo: number) {
  const result = num % modulo;
  return result < 0 ? result + modulo : result;
}

for (let i = 0; i < 5; i++) {
  for (let j = 0; j < 5; j++) {
    const rule = initialState.map((e) => e.slice()) as RowColumnState<CellState>;
    worldQuestRules[i][j] = rule;
    rule[i][j] = true;
    rule[modulus(i + 1, 5)][j] = true;
    rule[modulus(i - 1, 5)][j] = true;
    rule[i][modulus(j + 1, 5)] = true;
    rule[i][modulus(j - 1, 5)] = true;
  }
}

function gridEquals(gridA: RowColumnState<CellState>, gridB: RowColumnState<CellState>) {
  for (let i = 0; i < gridA.length; i++) {
    for (let j = 0; j < gridA[i].length; j++) {
      if (!!gridA[i][j] !== !!gridB[i][j]) {
        return false;
      }
    }
  }
  return true;
}

class WQSolver extends Solver {
  isSolution(state: State): boolean {
    return gridEquals(state.board, worldQuestDestState);
  }
}

type AppStatePackage = [
  instruction: string,
  progress: number,
  highlightPosition?: [i: number, j: number],
  setGridTo?: RowColumnState<CellState>,
  disableGridSelect?: boolean
];

function* performSolve(): Generator<AppStatePackage, undefined, typeof initialState> {
  const discernedRules = initalRules.map((c) => c.slice()) as RowColumnState<RuleDescription>;

  let currentGrid = yield [`Enter your current watcher grid and then click "Next"`, 0];

  if (gridEquals(currentGrid, worldQuestState)) {
    const solver = new WQSolver(false);
    const solution = solver.solutions({
      route: [],
      board: currentGrid,
      rules: worldQuestRules,
    });

    const firstSolution = solution.next();
    if (!firstSolution.value || firstSolution.done) {
      yield [`Something has gone wrong and no solution was found - refresh the page and start over to try again.`, 0, undefined, undefined, true];
      return;
    }
    const route = firstSolution.value.route;
    const routeText = "" + route.map((e) => mapCoord(...e));

    for (const coord of route) {
      const nextExpectedState = solver.applyRule(
        worldQuestRules[coord[0]][coord[1]]!,
        {
          route: [],
          board: currentGrid,
          rules: worldQuestRules,
        },
        ...coord
      );
      yield [
        `This looks like a grid for the world quest version of the puzzle - let's quickly solve it and get it out of the way. If you know it isn't, just step through this solution to the end. The full path is ${routeText}. Click on ${mapCoord(
          ...coord
        )} in-game and click "Next".`,
        0,
        coord,
        nextExpectedState.board,
        true,
      ];
      currentGrid = nextExpectedState.board;
    }

    currentGrid = yield [
      `This looks like a grid for the world quest version of the puzzle - let's quickly solve it and get it out of the way. If you know it isn't, just step through this solution to the end. The full path is ${routeText}. Click on C3 in-game and click "Next".`,
      0,
      [2, 2],
      undefined,
      true,
    ];

    currentGrid = yield [
      `And that should be solved! Check to see if your box has spawned at the entrance to the room, if not, continue by placing the watcher statue at the appropriate position to start the felcycle version of the puzzle, then enter your new watcher grid and click "Next".`,
      0,
    ];
  }

  while (discernedRules.some((r) => r.some((elem) => !elem))) {
    if (solvable()) {
      break;
    }

    const nextPos = getNextImmediatelyCheckableRule();

    if (!nextPos) {
      // Can't immediately press a statue of interest, lookup another statue that can raise one of interest
      const fallbackPos = getStatueThatCanActivateAStatueOfInterest();
      if (!fallbackPos) {
        const firstUnreachable = getFirstUnreachableStatue();
        currentGrid = yield [
          `There is no statue recorded as controlling statue ${mapCoord(
            ...firstUnreachable
          )}, but we need to test it to find a solution. You can try changing your grid around to make it accessible (both in-game and here) and press "Next", but most likely this indicates a data entry error somewhere along the way that will prevent finding a solution, and you need to refresh the page and start over.`,
          countDiscernedRules() / 25,
          firstUnreachable,
        ];
        continue;
      }
      const [fallbackPosI, fallbackPosJ] = fallbackPos;

      // Request the player click this statue in-game to shuffle the board state
      const nextExpectedState = new Solver(false).applyRule(
        discernedRules[fallbackPosI][fallbackPosJ]!,
        {
          route: [],
          board: currentGrid,
          rules: discernedRules as RowColumnState<RuleDescription>,
        },
        fallbackPosI,
        fallbackPosJ
      );

      yield [
        `Click statue ${mapCoord(fallbackPosI, fallbackPosJ)} in-game, and click "Next"`,
        countDiscernedRules() / 25,
        [fallbackPosI, fallbackPosJ],
        nextExpectedState.board,
        true,
      ];
      currentGrid = nextExpectedState.board;
    } else {
      // Request the player click this statue in-game
      const nextGrid = yield [
        `Click statue ${mapCoord(...nextPos)} in-game, update this grid to match in-game, and click "Next"`,
        countDiscernedRules() / 25,
        nextPos,
      ];

      const newRule = getGridDiff(currentGrid, nextGrid);
      const numberChanged = countChangesInRule(newRule);
      currentGrid = nextGrid;
      if (numberChanged !== 5) {
        // Invalid diff - wrong statue count changed
        currentGrid = yield [
          `Oops! It looks like you toggled ${numberChanged} statues there, but exactly 5 should have changed. So you don't have to start over entirely, we'll try that statue again later. Double check that this board matches what you have in-game and adjust if needed, then click "Next" to continue!`,
          countDiscernedRules() / 25,
        ];
      } else if (!newRule[nextPos[0]][nextPos[1]]) {
        // Invalid diff - requested statue not part of change
        currentGrid = yield [
          `Oops! It looks like you didn't toggle the requested statue as part of that change. So you don't have to start over entirely, we'll try that statue again later. Double check that this board matches what you have in-game and adjust if needed, then click "Next" to continue!`,
          countDiscernedRules() / 25,
        ];
      } else {
        discernedRules[nextPos[0]][nextPos[1]] = newRule;
      }
    }
  }

  currentGrid = yield [
    `Sufficient rules to discover a solution have been input! Double check this grid is accurate to your game, then click "Next" to generate a path to the solution! This might take a bit, depending on your computer, but probably not that long. If it takes too long, you may have input some state incorrectly - if so, you'll need to refresh the page and start over.`,
    1,
  ];

  // All rules discovered, solve!

  const solver = new Solver(false);
  const solutionGen = solver.solutions({
    route: [],
    board: currentGrid,
    rules: discernedRules as RowColumnState<RuleDescription>,
  });
  const firstSolution = solutionGen.next();
  if (!firstSolution.value || firstSolution.done) {
    yield [`Something has gone wrong and no solution was found - refresh the page and start over to try again.`, 0, undefined, undefined, true];
    return;
  }
  const route = firstSolution.value.route;
  for (const [i, j] of route) {
    const nextExpectedState = solver.applyRule(
      discernedRules[i][j]!,
      {
        route: [],
        board: currentGrid,
        rules: discernedRules as RowColumnState<RuleDescription>,
      },
      i,
      j
    );
    currentGrid = yield [
      `Solution generated! Full route: ${route.map((e) => mapCoord(...e))}.
Click on ${mapCoord(i, j)} in-game and then click "Next" here.`,
      1,
      [i, j],
      nextExpectedState.board,
      true,
    ];
  }

  yield [`Puzzle complete! Go collect your reward from the owl statue at the entrance to the room!`, 1, undefined, initialState, true];
  return;

  function getFirstUnreachableStatue(): [number, number] {
    for (let i = 0; i < discernedRules.length; i++) {
      for (let j = 0; j < discernedRules[i].length; j++) {
        if (!discernedRules[i][j] && !currentGrid[i][j]) {
          return [i, j];
        }
      }
    }
    throw new Error(
      "Somehow we think there's an unreachable statue (indicating a data input error), but there's no statues without a rule left that are inactive. If you see this error in the console... just start over, something is very wrong. This aughta be impossible."
    );
  }

  function countChangesInRule(rule: NonNullable<RuleDescription>) {
    return rule.reduce((p, elem) => p + elem.reduce((p, elem) => (elem ? p + 1 : p), 0), 0);
  }

  function getNextImmediatelyCheckableRule(): [number, number] | undefined {
    for (let i = 0; i < discernedRules.length; i++) {
      for (let j = 0; j < discernedRules[i].length; j++) {
        if (!discernedRules[i][j] && currentGrid[i][j]) {
          return [i, j];
        }
      }
    }
    return undefined;
  }

  function getStatueThatCanActivateAStatueOfInterest(): [number, number] | undefined {
    for (let i = 0; i < discernedRules.length; i++) {
      for (let j = 0; j < discernedRules[i].length; j++) {
        if (discernedRules[i][j] && currentGrid[i][j]) {
          // activatable statue we know the rules for - check if the rule activates an unknown statue
          const rule = discernedRules[i][j]!;
          for (let ii = 0; ii < rule.length; ii++) {
            for (let jj = 0; jj < rule[ii].length; jj++) {
              if (!discernedRules[ii][jj] && !currentGrid[ii][jj] && rule[ii][jj]) {
                return [i, j];
              }
            }
          }
        }
      }
    }
    return undefined;
  }

  function getGridDiff(gridA: RowColumnState<CellState>, gridB: RowColumnState<CellState>): NonNullable<RuleDescription> {
    const rule = (initialState.map((r) => r.slice()) as RuleDescription)!;
    for (let i = 0; i < gridA.length; i++) {
      for (let j = 0; j < gridA[i].length; j++) {
        if (gridA[i][j] !== gridB[i][j]) {
          rule[i][j] = true;
        }
      }
    }
    return rule;
  }

  function countDiscernedRules() {
    return discernedRules.reduce((p, elem) => p + elem.reduce((p, elem) => (elem ? p + 1 : p), 0), 0);
  }

  function solvable() {
    const ruleCount = countDiscernedRules();
    if (ruleCount < 5 || ruleCount > 15) {
      // Too few rules? don't even bother. Too many? Exhaustive check without
      // guarantee of solution takes too long; don't bother and just require the full ruleset
      return false;
    }
    const solver = new Solver(false);
    const gen = solver.solutions({
      route: [],
      board: currentGrid,
      rules: discernedRules,
    });
    const first = gen.next();
    if (!first.done) {
      return true;
    }
    return false;
  }
}

const stateGen = performSolve();
const inital = stateGen.next();

function App() {
  const [currentState, setCurrentState] = useState(inital);
  const [gridState, setGridState] = useState(initialState);
  if (!currentState.value) {
    return (
      <div className="App">
        <header className="App-header">
          <p>Eroneous early return from state generator.</p>
        </header>
      </div>
    );
  }
  const {
    value: [instructionText, progress, highlightTile, gridOverrideOnNext, disableGrid],
  } = currentState;
  const handleClick = (i: number, j: number) => {
    const newState = gridState.map((row) => row.slice()) as RowColumnState<CellState>;
    newState[i][j] = !newState[i][j];
    setGridState(newState);
  };
  const canAdvance = () => {
    const atLeastOneDeployed = gridState.some((row) => row.some((element) => element));
    return atLeastOneDeployed;
  };

  // Github pull request from yem0417
  // This function returns the number of current active owls in the room
  function getCurrentOwlCount(grid: RowColumnState<CellState>): number {
    const currentNumberOfOwls = grid.reduce((total, row) => total + row.filter((cell) => cell).length, 0);
    return currentNumberOfOwls;
  }

  return (
    <div className="App">
      <header className="App-header">
        <p>
          Welcome! This site functions as a solver for the Watcher statue puzzle within the Vault of the Wardens instance in World of Warcraft as part
          of the Felcycle secret. If you don't know what that is, check out the{" "}
          <a href="https://www.wowhead.com/guide/secrets/ratts-revenge-incognitro-felcycle-guide">Wowhead Article</a> or
          <a href="https://discord.gg/wowsecrets">WoW secrets discord!</a>
        </p>
        <p>{instructionText}</p>

        {/* Added a div containg the counter for the number of currently clicked owls */}
        <div className="owl-counter-container">
          Number of active owls : <span className={getCurrentOwlCount(gridState) > 0 ? "owl-count" : ""}>{getCurrentOwlCount(gridState)}</span>
        </div>

        <OwlGrid gridState={gridState} onGridELementClicked={handleClick} disabled={disableGrid} highlighted={highlightTile} progress={progress} />
        <button
          disabled={!canAdvance()}
          onClick={() => {
            if (gridOverrideOnNext) {
              setGridState(gridOverrideOnNext);
            }
            const nextVal = stateGen.next(gridState);
            if (!nextVal.done) {
              setCurrentState(nextVal);
            }
          }}
        >
          Next ⏩
        </button>
      </header>
      <footer>
        <sub>
          Check out the source on <a href="https://github.com/weswigham/watcher-solver">Github!</a>
        </sub>
      </footer>
    </div>
  );
}

export default App;
