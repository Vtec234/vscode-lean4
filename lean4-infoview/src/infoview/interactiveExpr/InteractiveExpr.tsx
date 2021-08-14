import * as React from 'react'
import * as ReactPopper from 'react-popper'
import { Instance as TippyInstance, Props as TippyRawProps } from 'tippy.js'
import { default as Tippy, TippyProps } from '@tippyjs/react'
import 'tippy.js/dist/tippy.css'
import 'tippy.js/themes/light-border.css'
import { v4 as uuidv4 } from 'uuid'

import { RpcContext } from "../contexts"
import { DocumentPosition } from '../util'
import { CodeToken, CodeWithInfos, InfoPopup, InfoWithCtx, InteractiveDiagnostics_infoToInteractive, InteractiveDiagnostics_msgToInteractive, MessageData, MsgEmbed, TaggedText } from './rpcInterface'
import { Goal } from './InteractiveGoals'

/** Invokes `handler` if the user clicks *outside* of `ref`. */
function useClickAwayEvents(ref: React.RefObject<HTMLElement | undefined>, handler: (ev: MouseEvent) => void) {
    React.useEffect(() => {
        const listener = (ev: MouseEvent) => {
            if (ref.current && !ref.current.contains(ev.target as HTMLElement)) {
                handler(ev)
            }
        }
        window.addEventListener('click', listener, true)
        return () => window.removeEventListener('click', listener, true)
    }, [ref])
}

function Popper(props: {children: React.ReactNode, popperContent: any, refEltAttrs: any}) {
    const { children, popperContent, refEltAttrs } = props
    const [referenceElement, setReferenceElement] = React.useState(null)
    const [popperElement, setPopperElement] = React.useState(null)
    const [arrowElement, setArrowElement] = React.useState(null)
    const { styles, attributes } = ReactPopper.usePopper(referenceElement, popperElement, {
        modifiers: [
            { name: 'arrow', options: { element: arrowElement } },
            { name: 'offset', options: { offset: [0, 8] } }
        ],
    })
    return (
        <>
            <span ref={setReferenceElement} {...refEltAttrs}>
                {children}
            </span>
            <div ref={setPopperElement as any} style={styles.popper} {...attributes.popper} className="tooltip">
                {popperContent}
                <div ref={setArrowElement as any} style={styles.arrow} className="arrow" />
            </div>
        </>
    )
}

/** A `span` that highlights when hovered over but its parents don't. Not doable with CSS. */
const HoverableBgSpan = React.forwardRef<HTMLSpanElement, React.HTMLProps<HTMLSpanElement>>((props, ref) => {
    const onPointerOver = (e: React.PointerEvent<HTMLSpanElement>) => {
        e.currentTarget.classList.add("hover-bg-light-blue")
        e.stopPropagation()
    }
    const onPointerOut = (e: React.PointerEvent<HTMLSpanElement>) => {
        e.currentTarget.classList.remove("hover-bg-light-blue")
        e.stopPropagation()
    }
    return <span onPointerOver={onPointerOver} onPointerOut={onPointerOut} ref={ref} {...props}>
        {props.children}
    </span>
})

// https://gist.github.com/atomiks/520f4b0c7b537202a23a3059d4eec908
const LazyTippy = React.forwardRef<HTMLElement, TippyProps>((props, ref) => {
  const [mounted, setMounted] = React.useState(false)

  const lazyPlugin = {
    fn: () => ({
      onMount: () => setMounted(true),
      onHidden: () => setMounted(false),
    }),
  }

  const computedProps: React.PropsWithChildren<TippyProps> = {...props}

  computedProps.plugins = [lazyPlugin, ...(props.plugins || [])]

  if (props.render) {
    computedProps.render = (...args) => (mounted && props.render ? props.render(...args) : undefined)
  } else {
    computedProps.content = mounted ? props.content : undefined
  }

  return <Tippy {...computedProps} ref={ref} />
})

function ComplainOnRender({pos, info}: {pos: DocumentPosition, info: InfoWithCtx}) {
    const rs = React.useContext(RpcContext)
    const [ip, setIp] = React.useState<InfoPopup>()

    React.useEffect(() => {
        InteractiveDiagnostics_infoToInteractive(rs, pos, info).then(val => {
            if (val) setIp(val)
        })
    }, [])

    if (ip) {
        return <>
            {ip.exprExplicit && <InteractiveCodeFormat pos={pos} fmt={ip.exprExplicit} />} : {ip.type && <InteractiveCodeFormat pos={pos} fmt={ip.type} />}
            {ip.doc && <hr />}
            {ip.doc && ip.doc} {/* TODO markdown */}
        </>
    } else return <>Loading..</>
}

const HoverableTippySpan = React.forwardRef<HTMLSpanElement, React.HTMLProps<HTMLSpanElement> & {pos: DocumentPosition, info: InfoWithCtx}>((props, ref) => {
    // HACK: We store the raw Tippy.js instance in order to be able to call `hideWithInteractivity`
    const tippyInstance = React.useRef<TippyInstance<TippyRawProps>>()
    const timeout = React.useRef<number>()
    const [stick, setStick] = React.useState<boolean>(false)
    const [isInside, setIsInside] = React.useState<boolean>(false)
    const delay = 500
    const onPointerOver = (e: React.PointerEvent<HTMLSpanElement>) => {
        e.stopPropagation()
        setIsInside(true)
        if (timeout.current) window.clearTimeout(timeout.current)
        timeout.current = window.setTimeout(() => {
            if (tippyInstance.current) {
                tippyInstance.current.show()
                tippyInstance.current.setProps({});
            }
        }, delay)
    }
    const onPointerOut = (e: React.PointerEvent<HTMLSpanElement>) => {
        e.stopPropagation()
        setIsInside(false)
        if (stick) return
        if (timeout.current) window.clearTimeout(timeout.current)
        timeout.current = window.setTimeout(() => {
            if (tippyInstance.current) {
                tippyInstance.current.hideWithInteractivity(e.nativeEvent)
            }
        }, delay)
    }
    const onClick = (e: React.MouseEvent<HTMLSpanElement>) => {
        e.stopPropagation()
        setStick(true)
        if (tippyInstance.current)
            tippyInstance.current.show()
    }
    return (
        <LazyTippy
            ref={ref}
            onCreate={inst => tippyInstance.current = inst}
            content={<ComplainOnRender {...props} />}
            onClickOutside={() => {
                if (tippyInstance.current && !isInside) {
                    tippyInstance.current.hide()
                    setStick(false)
                }
            }}
            hideOnClick={false}
            interactive
            trigger='manual'
        >
            <span onPointerOver={onPointerOver} className={isInside ? 'hover-bg-light-blue' : ''} onPointerOut={onPointerOut} onClick={onClick} {...props}>
                {props.children}
            </span>
        </LazyTippy>
    )
})

/**
 * Higher-order component which wraps `children` in a highlightable `<span>` that
 * shows a tooltip with information on hover. */
function WithInfoHover({pos, info, children}: React.PropsWithChildren<{pos: DocumentPosition, info: InfoWithCtx}>) {

    return <HoverableTippySpan pos={pos} info={info}>{children}</HoverableTippySpan>

    // if (ip) {
    //     const popup = <>
    //         {ip.exprExplicit && <InteractiveCodeFormat pos={pos} fmt={ip.exprExplicit} />} : {ip.type && <InteractiveCodeFormat pos={pos} fmt={ip.type} />}
    //         {ip.doc && <hr />}
    //         {ip.doc && ip.doc} {/* TODO markdown */}
    //     </>
    //     return <Popper ref={ref} popperContent={popup} refEltAttrs={{}}>
    //         <HoverableBgSpan
    //             onClick={ev => {
    //                 setIp(undefined)
    //                 ev.stopPropagation()
    //             }}
    //         >{children}</HoverableBgSpan>
    //     </Popper>
    // } else {
    //     return <HoverableBgSpan
    //             onClick={ev => {
    //                 InteractiveDiagnostics_infoToInteractive(rs, pos, info).then(val => {
    //                     if (val) setIp(val)
    //                 })
    //                 ev.stopPropagation()
    //             }}>
    //         {children}
    //     </HoverableBgSpan>
    // }
}

interface FormatComponentProps<T> {
    pos: DocumentPosition
    fmt: TaggedText<T>
}

interface FormatTagProps<T> extends FormatComponentProps<T> {
    tag: T
}

interface FormatProps<T> extends FormatComponentProps<T> {
    InnerTagUi: (_: FormatTagProps<T>) => JSX.Element
}

/**
 * Core loop to display `Format` objects. Invokes `InnerTagUi` on `tag` nodes in order to support
 * various embedded information such as `InfoTree`s and `Expr`s.
 * */
function InteractiveFormat<T>({pos, fmt, InnerTagUi}: FormatProps<T>) {
    if ('text' in fmt) return <>{fmt.text}</>
    else if ('append' in fmt) return <>
        {fmt.append.map(a => <InteractiveFormat key={uuidv4()} pos={pos} fmt={a} InnerTagUi={InnerTagUi} />)}
    </>
    else if ('tag' in fmt) return <InnerTagUi pos={pos} fmt={fmt.tag[1]} tag={fmt.tag[0]} />
    else throw `malformed 'TaggedText': '${fmt}'`
}

export function InteractiveCodeFormat({pos, fmt}: {pos: DocumentPosition, fmt: CodeWithInfos}) {
    return InteractiveFormat({pos, fmt, InnerTagUi: CodeTagFormat})
}

function CodeTagFormat({pos, tag: ct, fmt}: FormatTagProps<CodeToken>) {
    return <WithInfoHover pos={pos} info={ct.info}>
        <InteractiveCodeFormat pos={pos} fmt={fmt} />
    </WithInfoHover>
}

export function InteractiveMessageFormat({pos, fmt}: {pos: DocumentPosition, fmt: TaggedText<MsgEmbed>}) {
    return InteractiveFormat({pos, fmt, InnerTagUi: MessageTagFormat})
}

function CollapsibleTrace({pos, col, cls, msg}: {pos: DocumentPosition, col: number, cls: string, msg: MessageData}) {
    const rs = React.useContext(RpcContext)
    const [tt, setTt] = React.useState<TaggedText<MsgEmbed> | undefined>(undefined)

    let inner = undefined
    if (tt) {
        inner = <>
            <span className="underline-hover pointer"
                onClick={ev => {
                    setTt(undefined)
                    ev.stopPropagation()
                }}>[{cls.slice(1)}] ∨</span>
            <InteractiveMessageFormat pos={pos} fmt={tt} />
        </>
    } else {
        inner =
            <span className="underline-hover pointer"
                onClick={ev => {
                    InteractiveDiagnostics_msgToInteractive(rs, pos, { msg, indent: col }).then(tt => {
                        if (tt) setTt(tt)
                    })
                    ev.stopPropagation()
                }}>[{cls.slice(1)}] &gt;</span>
    }
    return inner
}

function MessageTagFormat({pos, tag: embed, fmt}: FormatTagProps<MsgEmbed>): JSX.Element {
    if ('expr' in embed)
        return <InteractiveCodeFormat pos={pos} fmt={embed.expr} />
    else if ('goal' in embed)
        return <Goal pos={pos} goal={embed.goal} />
    else if ('lazyTrace' in embed)
        return <CollapsibleTrace pos={pos} col={embed.lazyTrace[0]} cls={embed.lazyTrace[1]} msg={embed.lazyTrace[2]} />
    else
        throw `malformed 'MsgEmbed': '${embed}'`
}
