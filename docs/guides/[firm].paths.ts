import { CURATED_ASSESSMENTS } from '../../shared/assessment-catalog'
import { firmPage } from '../.vitepress/catalog'

export default { paths: () => CURATED_ASSESSMENTS.map(firmPage) }
