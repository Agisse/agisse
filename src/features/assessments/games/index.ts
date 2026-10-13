import type { GameId } from '../../../../shared/assessments'
import type { GameDef } from '../engine/types'
import { numericalSpeed } from './NumericalSpeed'
import { workingMemory } from './WorkingMemory'
import { nBack } from './NBack'
import { goNoGo } from './GoNoGo'
import { taskSwitching } from './TaskSwitching'
import { sequenceReasoning } from './SequenceReasoning'
import { spatialMemory } from './SpatialMemory'
import { riskReward } from './RiskReward'
import { attentionTracking } from './AttentionTracking'
import { estimation } from './Estimation'
import { numerosity } from './Numerosity'
import { disconumbers } from './Disconumbers'
import { pathfinder } from './Pathfinder'
import { imagePuzzle } from './ImagePuzzle'
import { shapeMatch } from './ShapeMatch'
import { emotions } from './Emotions'
import { balloons } from './Balloons'
import { cards } from './Cards'
import { easyHard } from './EasyHard'
import { keypresses } from './Keypresses'
import { flanker } from './Flanker'
import { lengths } from './Lengths'
import { towers } from './Towers'
import { moneyExchange } from './MoneyExchange'
import { securityDial } from './SecurityDial'
import { predict } from './Predict'
import { teamSales } from './TeamSales'
import { balance } from './Balance'
import { order } from './Order'
import { tokenSearch } from './TokenSearch'
import { gridChallenge } from './GridChallenge'
import { switchChallenge } from './SwitchChallenge'
import { digitChallenge } from './DigitChallenge'
import { motionChallenge } from './MotionChallenge'
import { gapChallenge } from './GapChallenge'
import { gridLock } from './GridLock'
import { numbubbles } from './Numbubbles'
import { proofIt } from './ProofIt'
import { tallyUp } from './TallyUp'
import { seaWolf } from './SeaWolf'
import { redrock } from './Redrock'
import { numericalData } from './NumericalData'
import { verbalTfc } from './VerbalTfc'
import { sjt } from './Sjt'
import { criticalReasoning } from './CriticalReasoning'
import { diagrammatic } from './Diagrammatic'

export const GAMES: Record<GameId, GameDef> = {
  'numerical-speed': numericalSpeed,
  'working-memory': workingMemory,
  'n-back': nBack,
  'go-no-go': goNoGo,
  'task-switching': taskSwitching,
  'sequence-reasoning': sequenceReasoning,
  'spatial-memory': spatialMemory,
  'risk-reward': riskReward,
  'attention-tracking': attentionTracking,
  estimation,
  numerosity,
  disconumbers,
  pathfinder,
  'image-puzzle': imagePuzzle,
  'shape-match': shapeMatch,
  emotions,
  balloons,
  cards,
  'easy-hard': easyHard,
  keypresses,
  flanker,
  lengths,
  towers,
  'money-exchange': moneyExchange,
  'security-dial': securityDial,
  predict,
  'team-sales': teamSales,
  balance,
  order,
  'token-search': tokenSearch,
  'grid-challenge': gridChallenge,
  'switch-challenge': switchChallenge,
  'digit-challenge': digitChallenge,
  'motion-challenge': motionChallenge,
  'gap-challenge': gapChallenge,
  'grid-lock': gridLock,
  numbubbles,
  'proof-it': proofIt,
  'tally-up': tallyUp,
  'sea-wolf': seaWolf,
  redrock,
  'numerical-data': numericalData,
  'verbal-tfc': verbalTfc,
  sjt,
  'critical-reasoning': criticalReasoning,
  diagrammatic,
}
