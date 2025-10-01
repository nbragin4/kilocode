// Auto-export all handlers - they self-register on import
// Drop any new handler file in this directory and it automatically gets loaded

export * from "./connectionHandler"
export * from "./dataHandler"
export * from "./executionHandler"
export * from "./testDetailsHandler"

// Future handlers - just add exports here and they auto-register
// export * from './profileHandler'
// export * from './historyHandler'
// export * from './exportHandler'
