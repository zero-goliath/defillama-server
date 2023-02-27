import data, { Protocol } from "../../../protocols/data";
import { AdaptorsConfig, IJSON } from "../types"
import { sluggifyString } from "../../../utils/sluggify";
import getAllChainsFromAdaptors, { getChainsFromBaseAdapter, getMethodologyData, getProtocolsData, isDisabled } from "../../utils/getAllChainsFromAdaptors";
import { ProtocolAdaptor } from "../types";
import { Adapter, BaseAdapter, ProtocolType } from "@defillama/dimension-adapters/adapters/types";
import { chainCoingeckoIds, getChainDisplayName } from "../../../utils/normalizeChain"
import { baseIconsUrl } from "../../../constants";
import { IImportObj } from "../../../cli/buildRequires";
import { getMethodologyByType } from "./methodology";
import overrides, { chainOverrides, IOverrides } from "./overrides";

// Obtaining all dex protocols
// const dexes = data.filter(d => d.category === "Dexes" || d.category === 'Derivatives')

export function notUndefined<T>(x: T | undefined): x is T {
    return x !== undefined;
}

const dataMap = data.reduce((acc, curr) => {
    acc[curr.id] = curr
    return acc
}, {} as IJSON<Protocol>)

const chainData = Object.entries(chainCoingeckoIds).map(([key, obj]) => {
    if (!obj.cmcId && !obj.chainId) return undefined
    return {
        ...obj,
        name: key,
        id: obj.cmcId ?? obj.chainId,
        gecko_id: obj.geckoId,
        category: "Chain",
        logo: `${baseIconsUrl}/chains/rsz_${getLogoKey(key)}.jpg`
    }
}).filter(c => c !== undefined) as unknown as Protocol[]

const chainDataMap = chainData.reduce((acc, curr) => {
    acc[curr.id] = curr
    return acc
}, {} as IJSON<Protocol>)

export type IImportsMap = IJSON<IImportObj>

// This could be much more efficient
export default (imports_obj: IImportsMap, config: AdaptorsConfig, type?: string): ProtocolAdaptor[] =>
    Object.entries(imports_obj).map(([adapterKey, adapterObj]) => {
        let list = dataMap
        let overridesObj = overrides(type)
        if (adapterObj.module.default?.protocolType === ProtocolType.CHAIN) {
            overridesObj = chainOverrides
            list = chainDataMap
        }
        const protocolId = config?.[adapterKey]?.id
        let moduleObject = imports_obj[adapterKey].module.default
        if (!protocolId || !moduleObject) return
        let dexFoundInProtocolsArr = [] as Protocol[]
        let baseModuleObject = {} as BaseAdapter
        if ('adapter' in moduleObject) {
            dexFoundInProtocolsArr.push(list[protocolId])
            baseModuleObject = moduleObject.adapter
        }
        else if ('breakdown' in moduleObject) {
            const protocolsData = config?.[adapterKey]?.protocolsData
            if (!protocolsData) throw "No protocols data defined for breakdown man!" + adapterKey
            dexFoundInProtocolsArr = Object.values(protocolsData).map(protocolData => {
                if (!list[protocolData.id]) console.error(`Protocol not found with id ${protocolData.id} and key ${adapterKey}`)
                return list[protocolData.id]
            }).filter(notUndefined)
        }
        if (dexFoundInProtocolsArr.length > 0 && imports_obj[adapterKey].module.default) {
            return dexFoundInProtocolsArr.map((dexFoundInProtocols => {
                let configObj = config[adapterKey]
                const protData = config?.[adapterKey]?.protocolsData
                if ('breakdown' in moduleObject) {
                    const [key, vConfig] = Object.entries(protData ?? {}).find(([, pd]) => pd.id === dexFoundInProtocols.id) ?? []
                    configObj = vConfig ?? config[adapterKey]
                    if (key)
                        baseModuleObject = moduleObject.breakdown[key]
                }
                const displayName = getDisplayName(dexFoundInProtocols.name, moduleObject)
                const childCategories = Object.values(overridesObj[adapterKey]?.protocolsData ?? {}).map(v => v?.category).filter(notUndefined)
                const displayCategory = getDisplayCategory(moduleObject, overridesObj[adapterKey]) ?? dexFoundInProtocols.category
                const infoItem = {
                    ...dexFoundInProtocols,
                    ...config[adapterKey],
                    ...configObj,
                    id: config[adapterKey].id,
                    module: adapterKey,
                    config: config[adapterKey],
                    category: displayCategory,
                    chains: getChainsFromBaseAdapter(baseModuleObject),
                    disabled: configObj.disabled ?? false,
                    displayName: configObj.displayName ?? displayName,
                    protocolsData: getProtocolsData(adapterKey, moduleObject, dexFoundInProtocols.category, overridesObj),
                    protocolType: adapterObj.module.default?.protocolType,
                    methodologyURL: adapterObj.codePath,
                    methodology: getMethodologyData(
                        displayName,
                        adapterKey,
                        moduleObject,
                        displayCategory ?? '',
                        childCategories
                    ),
                    ...overridesObj[adapterKey],
                }
                return infoItem
            }))
        }
        // TODO: Handle better errors
        console.error(`Missing info for ${adapterKey} on ${type}`)
        return undefined
    }).flat().filter(notUndefined);

function getDisplayCategory(adapter: Adapter, override: IOverrides[string]) {
    if ("breakdown" in adapter && Object.keys(adapter.breakdown).length === 1) {
        const versionName = Object.keys(adapter.breakdown)[0]
        return override?.protocolsData?.[versionName]?.category
    }
    return override?.category
}

export function getDisplayName(name: string, adapter: Adapter) {
    if (name.split(' ')[0].includes('AAVE')) return 'AAVE'
    if ("breakdown" in adapter && Object.keys(adapter.breakdown).length === 1) {
        const versionName = Object.keys(adapter.breakdown)[0]
        return `${name} - ${versionName.charAt(0).toUpperCase()}${versionName.slice(1)}`
    }
    if (adapter.protocolType === ProtocolType.CHAIN) return getChainDisplayName(name.toLowerCase(), true)
    return name
}

function getLogoKey(key: string) {
    if (key.toLowerCase() === 'bsc') return 'binance'
    else return key.toLowerCase()
}

// This should be changed to be easier to mantain
export const ID_MAP: IJSON<{ id: string, name: string } | undefined> = {
    "2196": {
        id: "1",
        name: "Uniswap"
    },
    "1599": {
        id: "111",
        name: "AAVE"
    }
}

export const getBySpecificId = (key: string, id: string) => {
    if (key === 'uniswap') return id === "2196"
    if (key === 'aave') return id === "1599"
    if (key === 'mimo') return id === "1241"
    if (key === '0x') return id === "2116"
    if (key === 'pact') return id === "1468"
    if (key === 'karura-swap') return id === "451"
    if (key === 'algofi') return id === "2091"
    if (key === 'penguin') return id === "1575"
    if (key === 'xdai') return id === "1659"
    if (key === 'stargate') return id === "1571"
    if (key === 'thena') return id === "2417"
    if (key === 'verse') return id === "1732"
    if (key === 'blur') return id === "2414"
    if (key === 'solidlydex') return id === "2400"
    if (key === 'tethys-finance') return id === "1139"
    if (key === 'ashswap') return id === "2551"
    return false
}