import * as React from 'react'

import { EditorContext, RpcContext } from './contexts'
import { DocumentPosition, useAsync } from './util'
import { InfoWithCtx, InteractiveGoals, InteractiveGoals_registerRefs } from './rpcInterface'
import { TextDocumentPositionParams } from 'vscode-languageserver-protocol'
import { RpcSessions } from './rpcSessions'
/*
Coordinates are an ad-hoc way of identifying a certain subobject
of a given object. For example, we might refer to a subexpression `10`
of a hypothesis H on interactive goal G as `[G, "hyps", H, 10]`.

Rather than building a specific set of types for describing a location in InteractiveGoals,
an array of strings and numbers is used because it does not have to be changed every time the
InteractiveGoals API is changed. This may lead to some compatibility issues later, so once the
API has stabilised we can convert this to a more type-safe representation.
*/
export type coord = string | number
function isCoord(c: unknown): c is coord {
  return (typeof c === 'string') || (typeof c === 'number')
}
/** Context storing where in the InteractiveGoals (or any other structure)
 * we are currently focussed. This is used to implement contextual suggesitons
 * (that is, you click on a subexpression in the infoview and it offers a set of available rewrites).
 */
export const LocationContext = React.createContext<coord[]>([]);

interface PushLocationProps {
  children: any
  coord: coord | coord[]
}

/** Use this component to push an extra `coord` to the `LocationContext`.
 *
 * #### Example:
 * ```ts
 * // LocationContext is [a,b,c]
 * <PushLocation coord={d}>
 *   // LocationContext is [a,b,c,d]
 *   ... some children
 * </PushLocation>
 * ```
 */
export function PushLocation({ children, coord }: PushLocationProps) {
  const ctx = React.useContext(LocationContext)
  const loc = isCoord(coord) ? [coord] : coord
  return <LocationContext.Provider value={[...ctx, ...loc]}>{children}</LocationContext.Provider>
}

export interface ContextualSuggestionQueryRequest {
  pos : TextDocumentPositionParams;
  loc : (string | number)[]
}

interface Suggestion {
  /** The text to show to the user in the suggestion viewer. */
  display : string
  /** The text that should be inserted on the above line. */
  insert : string
  /** This is the goals state after the suggestion has been applied.
   * This enables us to make a UI where you can see how the goal state changes
   * without needing to click on it and insert text in to the document.
   */
  goals : InteractiveGoals
}

interface ContextualSuggestionQueryResponse{
  completions: Suggestion[]
}

export async function  queryContextualSuggestions(rs : RpcSessions, pos : DocumentPosition, args : ContextualSuggestionQueryRequest) : Promise<ContextualSuggestionQueryResponse> {
  const ret = await rs.call<ContextualSuggestionQueryResponse>(pos, 'Lean.Widget.queryContextualSuggestions', args)
  if (!ret) {
      return {completions : []}
  }
  for (const suggestion of ret.completions) {
      InteractiveGoals_registerRefs(rs, pos, suggestion.goals)
  }
  return ret
}

interface SuggestionsSectionProps {
  pos: DocumentPosition
  subexprPos?: number
  info: InfoWithCtx
  redrawTooltip() : void
}
/** This is used to offer contextual suggestions within an `TypePopupContents` component. */
export function SuggestionsSection(props: SuggestionsSectionProps) {
  const rs = React.useContext(RpcContext)
  const ec = React.useContext(EditorContext)
  const pos = props.pos
  let loc = React.useContext(LocationContext)
  if (props.subexprPos) {
    loc = [...loc, props.subexprPos]
  }
  const [suggestionStatus, suggestions, suggestionErr] = useAsync(
    () => queryContextualSuggestions(rs, pos, { pos: DocumentPosition.toTdpp(pos), loc }),
    [rs, pos.uri, pos.line, pos.character, props.info, props.subexprPos]
  )
  React.useEffect(() => props.redrawTooltip(), [suggestionStatus])
  if (suggestionStatus === 'fulfilled' && suggestions && suggestions.completions.length > 0) {
    // [todo] <hr/> should be intercalated by parent component.
    return <><hr/><ol className="list pa0">
      {suggestions && suggestions.completions.map(s =>
        <li key={s.insert}>
          <a className="link pointer" title={s.insert} onClick={e => {
            void ec.api.insertText(s.insert, 'above', DocumentPosition.toTdpp(pos))
            e.preventDefault()
          }}>{s.display}</a>
        </li>)}
    </ol></>
  } else {
    return <></>
  }
  // [todo] add a nice loading spinner or something if pending.
  // [todo] get useAsync to cancel the task if we navigate away?
}
