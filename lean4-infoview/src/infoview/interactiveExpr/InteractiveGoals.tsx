import * as React from 'react'
import { v4 as uuidv4 } from 'uuid'
import { DocumentPosition } from '../util'
import { ConfigContext } from '../contexts'
import { InteractiveCodeFormat } from './InteractiveExpr'
import { InteractiveGoal, InteractiveGoals } from './rpcInterface'

/* export function getGoals(plainGoals: PlainGoal): string[] {
    if (plainGoals.goals) return plainGoals.goals
    const goals: string[] = []
    const r = /```lean\n([^`]*)```/g
    let match: RegExpExecArray | null
    const unformatted = plainGoals.rendered
    do {
        match = r.exec(unformatted)
        if (match) {
            goals.push(match[1])
        }
    } while (match)
    return goals
} */

export function Goal({pos, goal}: {pos: DocumentPosition, goal: InteractiveGoal}) {
    const divStyle: React.CSSProperties = {
        whiteSpace: 'pre-wrap',
    }

    return <div className="font-code tl" style={divStyle}>
        <ul className="list pl0">
            {goal.userName && <li key={'case'}><strong className="goal-case">case </strong>{goal.userName}</li>}
            {goal.hyps.map (h => {

                const names = h.names.reduce((acc, n) => acc + " " + n, "").slice(1)
                return <li key={uuidv4()}>
                    <strong className="goal-hyp">{names}</strong> : <InteractiveCodeFormat pos={pos} fmt={h.type} />{h.val && <> := <InteractiveCodeFormat pos={pos} fmt={h.val}/></>}
                </li>
            })}
            <li key={uuidv4()}>
                <strong className="goal-vdash">⊢ </strong><InteractiveCodeFormat pos={pos} fmt={goal.type} />
            </li>
        </ul>
    </div>
}

export function Goals({pos, goals}: {pos: DocumentPosition, goals: InteractiveGoals}) {
    const config = React.useContext(ConfigContext)
    const reFilters = config.infoViewTacticStateFilters || []
    const [filterIndex, setFilterIndex] = React.useState<number>(config.filterIndex ?? -1)

    if (goals.goals.length === 0) {
        return <>Goals accomplished 🎉</>
    } else {
        return <>
            {goals.goals.map (g => <Goal key={uuidv4()} pos={pos} goal={g} />)}
        </>
    }
}
