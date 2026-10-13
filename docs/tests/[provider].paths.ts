import { PROVIDER_IDS, providerPage } from '../.vitepress/catalog'

export default { paths: () => PROVIDER_IDS.map(providerPage) }
