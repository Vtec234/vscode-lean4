export class Logger {
    log: { persistentLog: string }
    updateUi: (_: void) => void

    constructor(updateUi: (_: void) => void) {
        this.log = { persistentLog: '' }
        this.updateUi = updateUi
    }

    append(msg: string) {
        this.log.persistentLog += msg + '\n'
    }
}
