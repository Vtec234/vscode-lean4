import * as React from 'react';

import { InteractiveCode } from './infoview/interactiveCode';
import { InteractiveDiagnostics_msgToInteractive, TaggedText, MsgEmbed, Lean_Widget_ppExprTagged, ExprWithCtx, CodeWithInfos, MessageData } from './infoview/rpcInterface';
import { InteractiveMessage } from './infoview/traceExplorer';
import { DocumentPosition } from './infoview/util';
import { RpcContext } from './infoview/contexts';

export { DocumentPosition };
export { EditorContext, RpcContext, VersionContext } from './infoview/contexts';
export { EditorConnection } from './infoview/editorConnection';
export { RpcSessions } from './infoview/rpcSessions';
export { ServerVersion } from './infoview/serverVersion';

/** Display the given expression as interactive, pretty-printed text. If `explicit = true`,
 * pretty-print with `set_option pp.all true`. */
export function InteractiveExpr({pos, expr, explicit}: {pos: DocumentPosition, expr: ExprWithCtx, explicit: boolean}) {
    const rs = React.useContext(RpcContext)
    const [fmt, setFmt] = React.useState<CodeWithInfos | undefined>(undefined)

    React.useEffect(() => {
        void Lean_Widget_ppExprTagged(rs, pos, expr, explicit)
            .then(fmt => fmt && setFmt(fmt))
    }, [pos.character, pos.line, pos.uri, fmt])

    if (fmt) return <InteractiveCode pos={pos} fmt={fmt} />
    else return <></>
}

/** Display the given message data as interactive, pretty-printed text. */
export function InteractiveMessageData({pos, msg}: {pos: DocumentPosition, msg: MessageData}) {
    const rs = React.useContext(RpcContext)
    const [tt, setTt] = React.useState<TaggedText<MsgEmbed> | undefined>(undefined)

    React.useEffect(() => {
        void InteractiveDiagnostics_msgToInteractive(rs, pos, msg, 0)
            .then(tt => tt && setTt(tt))
    }, [pos.character, pos.line, pos.uri, msg])

    if (tt) return <InteractiveMessage pos={pos} fmt={tt} />
    else return <></>
}
