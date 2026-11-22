/**
 * Browser half of the bookmarks board.
 *
 * Three registrations, one store:
 * - a right-Sidebar tab type (`ask-reader`) with its body, so a pinned excerpt
 *   lives in the right column beside the conversation and reads as rendered
 *   Markdown rather than source;
 * - an icon action under every finalized assistant reply that pins that reply;
 * - a header button that reveals the column.
 *
 * The pinned text stays in the browser (localStorage, per Session). Asking about
 * it goes back through the composer: the panel inserts the selection as a
 * Markdown quote, so the user's question and the text it is about reach the model
 * together in the main chat.
 */
window.__ModuleLoader__.load({
  id: 'dsh-pin-bookmarks',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Copy namespace of the plugin's own visible text. */
    const NS = 'askReader'
    /** Tab kind the panel opens under. */
    const KIND = 'ask-reader'
    /** Implementation id: the key the body registers under and the type's own name. */
    const TAB_ID = 'dsh-pin-bookmarks'
    const STORAGE_PREFIX = 'dsh-pin-bookmarks:v1:'
    /** Where pins lived before the rename; read once, then copied forward. */
    const LEGACY_STORAGE_PREFIX = 'dsh-ask-reader:v1:'
    /** Most recent pins kept per Session. */
    const ENTRY_LIMIT = 40
    /** Quote budget toward the composer: a reply is already in the log, a pasted excerpt is not. */
    const QUOTE_LIMIT_REPLY = 2000
    const QUOTE_LIMIT_PASTE = 6000
    /** Shortest and longest a pinned turn's rail marker may be drawn, in px. */
    const RAIL_MIN = 22
    const RAIL_MAX = 28
    /** The lengths a non-uniform rail cycles through, the two bounds first. */
    const RAIL_STEPS = [RAIL_MIN, RAIL_MAX, RAIL_MIN + 2, RAIL_MAX - 2]
    /** Pinned width before the user picks one, in px. */
    const RAIL_DEFAULT_WIDTH = 26
    /** The tick the host paints on a normal rail mark: its width and height, in px. */
    const RAIL_TICK_WIDTH = 20
    const RAIL_TICK_HEIGHT = 2
    /** How thick a pinned tick is drawn, in px: heavier than a normal tick. */
    const RAIL_PINNED_HEIGHT = 4
    /** The bright palette a pinned turn is drawn with — a new pin and a backfilled legacy row alike. */
    const RAIL_COLORS = ['#00bfd8', '#ff669b', '#a78bfa', '#ffae38', '#38c98b', '#5598ff']
    /** How long one jump keeps paging back for a message outside the loaded window, ms. */
    const JUMP_BUDGET_MS = 15000
    /** Hard cap on pages one jump may pull, whatever the clock says. */
    const JUMP_PAGE_LIMIT = 60
    /** Gap between two history pulls, ms: about how long a page takes to mount. */
    const JUMP_STEP_MS = 240
    /** Pulls in a row without the conversation growing before a jump calls it a stall. */
    const JUMP_STALL_LIMIT = 8

    const DICT = {
      zh: {
        'tab.title': '书签',
        'rail.heading': '收藏横线',
        'rail.intro': '调整聊天右侧的轮次导航，设置对本机所有会话生效。',
        'rail.uniformColor': '统一颜色',
        'rail.colorHint': '关闭后，每个收藏轮次使用不同的亮色。',
        'rail.color': '收藏颜色',
        'rail.uniformLength': '统一长度',
        'rail.lengthHint': '关闭后按收藏顺序使用 ' + RAIL_STEPS.join('、') + ' 像素；最短也比普通横线长。',
        'rail.width': '收藏长度',
        'rail.preview': '效果预览',
        'rail.ordinary': '普通横线（最长）',
        'rail.pinned': '收藏横线',
        'rail.failed': '设置未能保存，请检查本地存储。',
        'guide.title': '书签',
        'guide.description': '把一段回复钉在这里慢慢看，再就其中看不懂的地方提问。',
        'header.open': '打开书签',
        'save.action': '收藏并展开书签',
        'save.quiet': '收藏到书签',
        'save.starred': '已收藏 · 再点一次取消收藏',
        'save.open': '在书签中打开',
        'save.empty': '这一条没有可保存的文字。',
        'empty.title': '还没有内容',
        'empty.hint': '在助手回复下方点「收藏到书签」，或把一段文字粘贴到下面。',
        'compose.toggle': '粘贴一段文字',
        'compose.placeholder': '把想留着看的文字粘贴到这里……',
        'compose.save': '保存',
        'compose.cancel': '取消',
        'action.ask': '提问',
        'action.askSelection': '提问所选',
        'action.copy': '复制',
        'action.remove': '删除',
        'action.jump': '跳转',
        'action.expand': '展开',
        'action.collapse': '收起',
        'clear': '清空',
        'clear.confirm': '再点一次清空',
        'source.reply': '回复',
        'source.paste': '摘录',
        'pick.action': '添加到主聊天',
        'quote.suffix': '\n…（后略）',
        'note.quoted': '已把这段放进主聊天输入框，补上你的问题再发送。',
        'note.quotedClipped': '已把这段放进主聊天输入框，超出长度的部分已截断；补上你的问题再发送。',
        'note.copied': '已复制到剪贴板。',
        'note.copiedForAsk': '输入框不可用，这段已复制到剪贴板，可以直接粘贴到主聊天。',
        'note.copyFailed': '复制没有成功，请手动选中文字复制。',
        'note.saved': '已存入书签',
        'note.alreadySaved': '这条回复已经在书签里了。',
        'note.unpinned': '已取消收藏',
        'note.jumping': '正在向上翻找这条消息……',
        'note.jumpMissing': '翻到会话开头也没有找到这条消息。',
        'note.jumpIncomplete': '没能定位到这条消息（已尝试向上翻 {pages} 页），更早的历史可能还没加载完。',
        'note.storageFailed': '浏览器拒绝保存，这次的内容只在当前页面有效。',
        'note.noTurn': '这条收藏找不到所在轮次，右侧横线无法显示',
        'unit.entries': '条',
      },
      en: {
        'tab.title': 'Bookmarks',
        'rail.heading': 'Pinned turn markers',
        'rail.intro': 'Customize the turn navigator for all conversations on this device.',
        'rail.uniformColor': 'Use one color',
        'rail.colorHint': 'Turn off to give each pinned turn its own bright color.',
        'rail.color': 'Pin color',
        'rail.uniformLength': 'Use one length',
        'rail.lengthHint': 'Turn off to cycle through ' + RAIL_STEPS.slice(0, -1).join(', ') + ' and ' + RAIL_STEPS[RAIL_STEPS.length - 1] + ' px in pin order. Even the shortest exceeds a regular marker.',
        'rail.width': 'Pin length',
        'rail.preview': 'Preview',
        'rail.ordinary': 'Regular marker (longest)',
        'rail.pinned': 'Pinned markers',
        'rail.failed': 'Settings could not be saved. Check local storage.',
        'guide.title': 'Bookmarks',
        'guide.description': 'Pin a reply here to read it, then ask about the parts that are unclear.',
        'header.open': 'Open bookmarks',
        'save.action': 'Pin and open bookmarks',
        'save.quiet': 'Pin to bookmarks',
        'save.starred': 'Pinned · click again to unpin',
        'save.open': 'Open in bookmarks',
        'save.empty': 'This message has no text to pin.',
        'empty.title': 'Nothing pinned yet',
        'empty.hint': 'Use “Pin to bookmarks” under a reply, or paste text below.',
        'compose.toggle': 'Paste text',
        'compose.placeholder': 'Paste the text you want to keep…',
        'compose.save': 'Save',
        'compose.cancel': 'Cancel',
        'action.ask': 'Ask',
        'action.askSelection': 'Ask selection',
        'action.copy': 'Copy',
        'action.remove': 'Remove',
        'action.jump': 'Jump',
        'action.expand': 'Expand',
        'action.collapse': 'Collapse',
        'clear': 'Clear',
        'clear.confirm': 'Click again to clear',
        'source.reply': 'Reply',
        'source.paste': 'Excerpt',
        'pick.action': 'Send to chat',
        'quote.suffix': '\n… (truncated)',
        'note.quoted': 'Added to the main composer — add your question and send.',
        'note.quotedClipped': 'Added to the main composer; the part over the limit was cut — add your question and send.',
        'note.copied': 'Copied to the clipboard.',
        'note.copiedForAsk': 'Composer unavailable; the text is on the clipboard.',
        'note.copyFailed': 'Copy failed — select the text and copy it by hand.',
        'note.saved': 'Saved to bookmarks',
        'note.alreadySaved': 'This reply is already pinned in Bookmarks',
        'note.unpinned': 'Unpinned; the matching rail marker is back to normal.',
        'note.jumping': 'Paging back to find that message…',
        'note.jumpMissing': 'Reached the start of the conversation without finding that message.',
        'note.jumpIncomplete': 'Could not locate that message (paged back {pages} pages); older history may still be unloaded.',
        'note.storageFailed': 'The browser refused to save it; it lasts only for this page.',
        'note.noTurn': 'This pin has no turn, so it has no marker on the right',
        'unit.entries': 'pinned',
      },
    }

    const CSS = [
      '.akr-root{display:flex;flex-direction:column;height:100%;min-height:0;gap:8px;padding:10px;box-sizing:border-box;',
      'color:var(--dsw-alias-label-primary);font-size:var(--dsw-font-markdown-base-font-size,13px);line-height:1.55;}',
      '.akr-head{display:flex;align-items:center;gap:8px;flex:none;min-height:22px;}',
      '.akr-head-title{font-weight:600;}',
      '.akr-head-meta{color:var(--dsw-alias-label-secondary);font-size:12px;}',
      '.akr-spacer{flex:1;min-width:0;}',
      '.akr-btn{appearance:none;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);',
      'font:inherit;font-size:12px;line-height:18px;border-radius:var(--dsw-radius-sm,8px);padding:2px 7px;cursor:pointer;',
      'display:inline-flex;align-items:center;gap:4px;white-space:nowrap;}',
      '.akr-btn:hover{background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));color:var(--dsw-alias-label-primary);}',
      '.akr-btn[disabled]{opacity:.45;cursor:default;}',
      '.akr-btn-strong{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-border-l2);}',
      '.akr-btn-strong:hover{color:var(--dsw-alias-brand-primary);background:var(--dsw-alias-interactive-bg-hover,var(--dsw-alias-bg-layer-2));}',
      '.akr-list{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:8px;}',
      '.akr-card{border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm,8px);',
      'background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;min-height:0;flex:none;}',
      '.akr-card-head{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);}',
      '.akr-card-title{flex:1;min-width:0;font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.akr-time{flex:none;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);',
      'font-variant-numeric:tabular-nums;white-space:nowrap;}',
      '.akr-tag{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);',
      'border-radius:999px;padding:0 6px;line-height:16px;}',
      // A card reads in full by default; 收起 only folds it back to a preview.
      '.akr-body{padding:2px 0;overflow-y:auto;max-height:120px;user-select:text;}',
      '.akr-body-open{max-height:none;overflow-y:visible;}',
      // The selection pill: the same floating control the chat shows over a
      // selection, so quoting here feels like quoting there.
      '.akr-pick{position:fixed;z-index:2147483000;display:inline-flex;align-items:center;gap:4px;padding:5px 10px;',
      'border:1px solid var(--dsw-alias-brand-primary,#4c9ef0);border-radius:999px;',
      'background:var(--dsw-alias-button-floating-fill,var(--dsw-alias-bg-overlay));',
      'color:var(--dsw-alias-brand-primary,#4c9ef0);box-shadow:var(--dsw-elevation-panel,0 6px 20px rgba(0,0,0,.22));',
      'font:inherit;font-size:var(--dsh-content-font-size-secondary,13px);font-weight:600;line-height:18px;',
      'white-space:nowrap;cursor:pointer;}',
      '.akr-pick:hover{background:var(--dsw-alias-button-floating-hover,var(--dsw-alias-bg-layer-2));}',
      '.akr-card-foot{display:flex;align-items:center;gap:2px;padding:4px 6px;',
      'border-top:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap;}',
      // One quiet line under a card that cannot show its rail marker.
      '.akr-card-note{flex:none;padding:0 9px 6px;font-size:11.5px;line-height:16px;',
      'color:var(--dsw-alias-label-secondary);}',
      '.akr-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;',
      'color:var(--dsw-alias-label-secondary);text-align:center;padding:24px 14px;font-size:12.5px;}',
      '.akr-empty-title{color:var(--dsw-alias-label-primary);font-weight:600;}',
      '.akr-compose{flex:none;display:flex;flex-direction:column;gap:6px;}',
      '.akr-input{width:100%;box-sizing:border-box;resize:vertical;min-height:68px;max-height:220px;padding:8px;',
      'border-radius:var(--dsw-radius-sm,8px);border:1px solid var(--dsw-alias-border-l1);',
      'background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;line-height:1.6;}',
      '.akr-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary);}',
      '.akr-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}',
      '.akr-note{flex:none;font-size:12px;color:var(--dsw-alias-label-secondary);}',
      '.akr-note-error{color:var(--dsw-alias-state-error-primary);}',
      // Markdown: the reply is read as rendered prose, not as source.
      '.akr-md{padding:8px 10px;font-size:var(--dsw-font-markdown-base-font-size,13px);line-height:1.65;overflow-wrap:anywhere;}',
      '.akr-md>:first-child{margin-top:0;}',
      '.akr-md>:last-child{margin-bottom:0;}',
      '.akr-md p{margin:0 0 .6em;}',
      '.akr-md strong{font-weight:600;}',
      '.akr-md em{font-style:italic;}',
      '.akr-md del{text-decoration:line-through;color:var(--dsw-alias-label-secondary);}',
      '.akr-md a{color:var(--dsw-alias-brand-primary);text-decoration:none;}',
      '.akr-md a:hover{text-decoration:underline;}',
      '.akr-md ul,.akr-md ol{margin:.2em 0 .6em;padding-left:1.3em;}',
      '.akr-md li{margin:.12em 0;}',
      '.akr-md blockquote{margin:.4em 0;padding:.1em 0 .1em .7em;',
      'border-left:2px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);}',
      '.akr-md-hr{border:0;border-top:1px solid var(--dsw-alias-border-l1);margin:.8em 0;}',
      '.akr-md-h{font-weight:600;line-height:1.4;margin:.8em 0 .4em;}',
      '.akr-md-h1{font-size:1.35em;}',
      '.akr-md-h2{font-size:1.2em;}',
      '.akr-md-h3{font-size:1.08em;}',
      '.akr-md-h4,.akr-md-h5,.akr-md-h6{font-size:1em;}',
      '.akr-md-tablewrap{overflow-x:auto;margin:.5em 0;}',
      '.akr-md-table{border-collapse:collapse;font-size:12px;line-height:1.5;}',
      '.akr-md-table th,.akr-md-table td{border:1px solid var(--dsw-alias-border-l1);padding:3px 7px;text-align:left;vertical-align:top;}',
      '.akr-md-table th{background:var(--dsw-alias-bg-layer-2);font-weight:600;}',
      // Code chrome follows the chat's own markdown tokens, so a fence reads the
      // same here as it does in the conversation.
      '.akr-md-fence{margin:.5em 0;border-radius:var(--dsw-radius-sm,8px);overflow:hidden;',
      'background:var(--dsw-alias-markdown-code-block,var(--dsw-alias-bg-layer-2));}',
      '.akr-md-lang{font-size:11px;color:var(--dsw-alias-label-secondary);padding:3px 10px;',
      'background:var(--dsw-alias-markdown-code-block-banner,var(--dsw-alias-bg-layer-2));}',
      '.akr-md-code{margin:0;padding:8px 10px;overflow-x:auto;background:transparent;',
      'color:var(--shiki-foreground,var(--dsw-alias-label-primary));',
      'font:var(--dsw-font-markdown-code-block,12px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace);white-space:pre;}',
      '.akr-md-code code{font:inherit;background:none;border:0;padding:0;}',
      '.akr-icode{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace);font-size:.92em;',
      'background:var(--dsw-alias-markdown-inline-code,var(--dsw-alias-bg-layer-2));border-radius:4px;padding:0 4px;}',
    ].join('')

    /** Theme-token stylesheet, rendered as an element so unmounting removes it. */
    function Styles() {
      return h('style', { 'data-dsh-pin-bookmarks': '' }, CSS)
    }

    /** The pin glyph: an outlined star, filled in once that reply is on the board. */
    function StarGlyph({size, filled}) {
      return h('svg', {width:size, height:size, viewBox:'0 0 24 24', 'aria-hidden':true,
        fill:filled ? 'currentColor' : 'none', stroke:'currentColor', strokeWidth:1.7, strokeLinejoin:'round'},
        h('path', {d:'M12 2.7l2.86 5.79 6.39.93-4.62 4.5 1.09 6.36L12 17.28l-5.72 3 1.09-6.36-4.62-4.5 6.39-.93z'}))
    }

    /** The board's own mark: a bookmark ribbon, used by the header and the guide card. */
    function BookmarkGlyph(props) {
      const size = props && props.size ? props.size : 16
      return h('svg', {
        width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
        'aria-hidden': 'true', className: props && props.className,
      },
      h('path', {
        d: 'M4.35 2.6h7.3a.75.75 0 0 1 .75.75v10.15l-4.4-2.85-4.4 2.85V3.35a.75.75 0 0 1 .75-.75z',
        stroke: 'currentColor', strokeWidth: 1.4, strokeLinejoin: 'round', strokeLinecap: 'round',
      }))
    }

    /** The action glyph: a right arrow, the "send it into the right column" mark. */
    function ArrowGlyph(props) {
      const size = props && props.size ? props.size : 16
      return h('svg', {
        width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
        'aria-hidden': 'true', className: props && props.className,
      },
      h('path', {
        d: 'M2.9 8h9.2', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round',
      }),
      h('path', {
        d: 'M8.9 3.9 13 8l-4.1 4.1', stroke: 'currentColor', strokeWidth: 1.4,
        strokeLinecap: 'round', strokeLinejoin: 'round',
      }))
    }

    // ------------------------------------------- markdown: the pinned text ---

    /** Link targets a board can open: same rules as a chat link. */
    function safeHref(raw) {
      const value = String(raw || '').trim()
      return /^(https?:\/\/|mailto:)/i.test(value) ? value : undefined
    }

    /**
     * Inline Markdown as React nodes: code, strong, em, strike, link. Everything
     * else stays text, so nothing from a reply can become markup.
     * @param text - one block's inline source.
     * @param prefix - key prefix, unique within the card.
     * @returns the inline nodes.
     */
    function inlineNodes(text, prefix) {
      const source = String(text == null ? '' : text)
      const out = []
      const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\([^)\s]+\))/g
      let last = 0
      let index = 0
      let match = pattern.exec(source)
      while (match !== null) {
        if (match.index > last) out.push(source.slice(last, match.index))
        const token = match[0]
        const key = prefix + '-' + (index++)
        if (token.charAt(0) === '`') {
          out.push(h('code', { className: 'akr-icode', key }, token.slice(1, -1)))
        } else if (token.startsWith('**') || token.startsWith('__')) {
          out.push(h('strong', { key }, inlineNodes(token.slice(2, -2), key)))
        } else if (token.startsWith('~~')) {
          out.push(h('del', { key }, inlineNodes(token.slice(2, -2), key)))
        } else if (token.charAt(0) === '*') {
          out.push(h('em', { key }, inlineNodes(token.slice(1, -1), key)))
        } else if (token.charAt(0) === '_') {
          out.push(h('em', { key }, inlineNodes(token.slice(1, -1), key)))
        } else {
          const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token)
          const href = link ? safeHref(link[2]) : undefined
          if (link && href !== undefined) {
            out.push(h('a', { key, href, target: '_blank', rel: 'noreferrer noopener' }, inlineNodes(link[1], key)))
          } else {
            out.push(token)
          }
        }
        last = match.index + token.length
        match = pattern.exec(source)
      }
      if (last < source.length) out.push(source.slice(last))
      return out
    }

    /** One paragraph: its lines kept as line breaks, its markup as nodes. */
    function paragraph(lines, prefix) {
      const nodes = []
      lines.forEach((line, row) => {
        if (row > 0) nodes.push(h('br', { key: prefix + '-br' + row }))
        nodes.push(h(React.Fragment, { key: prefix + '-l' + row }, inlineNodes(line, prefix + '-' + row)))
      })
      return h('p', { key: prefix }, nodes)
    }

    /**
     * Syntax colours: the theme's own shiki palette (the same custom properties
     * the chat's code blocks resolve), so a fence here is coloured exactly like
     * one in the conversation and follows light/dark with the rest of the app.
     */
    const CODE_INK = {
      comment: 'var(--shiki-token-comment, var(--dsw-alias-label-secondary))',
      string: 'var(--shiki-token-string, #2f9e44)',
      constant: 'var(--shiki-token-constant, #1c7ed6)',
      keyword: 'var(--shiki-token-keyword, #d6336c)',
      function: 'var(--shiki-token-function, #6741d9)',
      punctuation: 'var(--shiki-token-punctuation, #495057)',
    }

    /** Lexical hints per language family: comment leaders, keywords, literal words. */
    const CODE_RULES = {
      js: {
        lines: ['//'], block: '/*',
        keywords: new Set(('const let var function return if else for while do switch case default break continue throw try catch '
          + 'finally new delete typeof instanceof in of class extends super this import from export async await yield static '
          + 'get set void interface type enum implements public private protected readonly as declare namespace').split(' ')),
        literals: new Set(['null', 'undefined', 'true', 'false', 'NaN', 'Infinity']),
      },
      py: {
        lines: ['#'], block: null,
        keywords: new Set(('def class return if elif else for while in not and or is import from as with try except finally '
          + 'raise lambda pass global nonlocal yield async await assert del break continue').split(' ')),
        literals: new Set(['None', 'True', 'False']),
      },
      go: {
        lines: ['//'], block: '/*',
        keywords: new Set(('func package import return if else for range switch case default break continue type struct '
          + 'interface map chan go defer select var const fallthrough goto').split(' ')),
        literals: new Set(['nil', 'true', 'false', 'iota']),
      },
      rust: {
        lines: ['//'], block: '/*',
        keywords: new Set(('fn let mut pub use mod struct enum impl trait for while loop if else match return as where const '
          + 'static ref move async await dyn unsafe type self Self').split(' ')),
        literals: new Set(['true', 'false', 'None', 'Some', 'Ok', 'Err']),
      },
      sh: {
        lines: ['#'], block: null,
        keywords: new Set(('if then else elif fi for in do done while case esac function return export local set unset source '
          + 'alias read echo cd exit').split(' ')),
        literals: new Set(['true', 'false']),
      },
      sql: {
        lines: ['--'], block: '/*',
        keywords: new Set(('select from where insert into values update set delete create table drop alter join left right '
          + 'inner outer on group by order having limit offset as and or not primary key index distinct union case when then '
          + 'else end').split(' ')),
        literals: new Set(['null', 'true', 'false']),
      },
      json: { lines: [], block: null, keywords: new Set([]), literals: new Set(['true', 'false', 'null']) },
      yaml: { lines: ['#'], block: null, keywords: new Set([]), literals: new Set(['true', 'false', 'null']) },
    }

    /** Map a fence's language tag onto one of the lexical families above. */
    function codeFamily(lang) {
      const tag = String(lang || '').toLowerCase()
      if (/^(js|jsx|mjs|cjs|ts|tsx|mts|cts|javascript|typescript)$/.test(tag)) return 'js'
      if (/^(py|python|py3)$/.test(tag)) return 'py'
      if (/^(go|golang)$/.test(tag)) return 'go'
      if (/^(rs|rust)$/.test(tag)) return 'rust'
      if (/^(sh|bash|zsh|shell|console)$/.test(tag)) return 'sh'
      if (/^(sql|mysql|sqlite|postgres|psql)$/.test(tag)) return 'sql'
      if (/^(json|jsonc)$/.test(tag)) return 'json'
      if (/^(ya?ml)$/.test(tag)) return 'yaml'
      return ''
    }

    /**
     * Colour one fenced block. A small scanner, not a parser: it recognises
     * comments, strings, numbers, keywords, literals and call names, and leaves
     * everything else in the foreground ink. That is enough to read code the way
     * the chat shows it, without shipping a highlighter engine.
     * @param source - the fence body.
     * @param lang - the fence's language tag.
     * @returns text and coloured spans, in source order.
     */
    function highlightCode(source, lang) {
      const text = String(source == null ? '' : source)
      const family = codeFamily(lang)
      const rules = family === '' ? undefined : CODE_RULES[family]
      if (rules === undefined) return [text]
      const out = []
      let plain = ''
      let i = 0
      const flush = () => { if (plain !== '') { out.push(plain); plain = '' } }
      const emit = (kind, value) => {
        flush()
        out.push(h('span', { key: 'k' + out.length, style: { color: CODE_INK[kind] } }, value))
      }
      const identStart = (ch) => /[A-Za-z_$]/.test(ch)
      const identPart = (ch) => /[A-Za-z0-9_$]/.test(ch)
      while (i < text.length) {
        const ch = text.charAt(i)
        const lineLeader = rules.lines.find((lead) => text.startsWith(lead, i))
        if (lineLeader !== undefined) {
          let end = text.indexOf('\n', i)
          if (end < 0) end = text.length
          emit('comment', text.slice(i, end))
          i = end
          continue
        }
        if (rules.block !== null && rules.block !== undefined && text.startsWith(rules.block, i)) {
          const close = text.indexOf('*/', i + 2)
          const end = close < 0 ? text.length : close + 2
          emit('comment', text.slice(i, end))
          i = end
          continue
        }
        if (ch === '"' || ch === "'" || ch === '`') {
          let j = i + 1
          while (j < text.length) {
            const at = text.charAt(j)
            if (at === '\\') { j += 2; continue }
            if (at === ch) { j += 1; break }
            if (ch !== '`' && at === '\n') break
            j += 1
          }
          emit('string', text.slice(i, j))
          i = j
          continue
        }
        if (/[0-9]/.test(ch) && !identPart(text.charAt(i - 1))) {
          let j = i
          while (j < text.length && /[0-9a-fA-FxXoObB._]/.test(text.charAt(j))) j += 1
          emit('constant', text.slice(i, j))
          i = j
          continue
        }
        if (identStart(ch)) {
          let j = i
          while (j < text.length && identPart(text.charAt(j))) j += 1
          const word = text.slice(i, j)
          if (rules.keywords.has(word)) emit('keyword', word)
          else if (rules.literals.has(word)) emit('constant', word)
          else {
            let k = j
            while (k < text.length && /[ \t]/.test(text.charAt(k))) k += 1
            if (text.charAt(k) === '(') emit('function', word)
            else plain += word
          }
          i = j
          continue
        }
        plain += ch
        i += 1
      }
      flush()
      return out
    }

    const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
    const HEADING = /^(#{1,6})\s+(.*)$/
    const FENCE = /^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/
    const RULE = /^\s*([-*_])\s*(\1\s*){2,}$/
    const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/

    /**
     * Markdown source as block elements: headings, paragraphs, lists, quotes,
     * fenced code, tables and rules. Math and inline HTML are shown as text.
     * @param text - the entry's Markdown source.
     * @returns the block nodes.
     */
    function mdBlocks(text) {
      const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n')
      const blocks = []
      let i = 0
      let seq = 0
      const keyOf = (tag) => 'md-' + (seq++) + '-' + tag

      while (i < lines.length) {
        const line = lines[i]
        if (/^\s*$/.test(line)) { i += 1; continue }

        const fence = FENCE.exec(line)
        if (fence) {
          const marker = fence[1].charAt(0)
          const lang = fence[2]
          const body = []
          i += 1
          while (i < lines.length && !new RegExp('^\\s*' + marker + '{3,}\\s*$').test(lines[i])) {
            body.push(lines[i])
            i += 1
          }
          i += 1
          blocks.push(h('div', { className: 'akr-md-fence', key: keyOf('fence') },
            lang ? h('div', { className: 'akr-md-lang', key: 'l' }, lang) : null,
            h('pre', { className: 'akr-md-code', key: 'c' },
              h('code', null, highlightCode(body.join('\n'), lang)))))
          continue
        }

        const heading = HEADING.exec(line)
        if (heading) {
          const level = heading[1].length
          blocks.push(h('div', {
            className: 'akr-md-h akr-md-h' + level,
            key: keyOf('h'),
          }, inlineNodes(heading[2], 'h' + seq)))
          i += 1
          continue
        }

        if (RULE.test(line)) {
          blocks.push(h('hr', { className: 'akr-md-hr', key: keyOf('hr') }))
          i += 1
          continue
        }

        if (line.includes('|') && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1])) {
          const cells = (row) => row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((cell) => cell.trim())
          const head = cells(line)
          i += 2
          const rows = []
          while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) {
            rows.push(cells(lines[i]))
            i += 1
          }
          blocks.push(h('div', { className: 'akr-md-tablewrap', key: keyOf('table') },
            h('table', { className: 'akr-md-table' },
              h('thead', null, h('tr', null, head.map((cell, column) => h('th', { key: 'h' + column }, inlineNodes(cell, 'th' + column))))),
              h('tbody', null, rows.map((row, index) => h('tr', { key: 'r' + index },
                row.map((cell, column) => h('td', { key: 'c' + column }, inlineNodes(cell, 'td' + index + '-' + column)))))))))
          continue
        }

        if (/^\s*>/.test(line)) {
          const inner = []
          while (i < lines.length && /^\s*>/.test(lines[i])) {
            inner.push(lines[i].replace(/^\s*>\s?/, ''))
            i += 1
          }
          blocks.push(h('blockquote', { key: keyOf('quote') }, mdBlocks(inner.join('\n'))))
          continue
        }

        const first = LIST_ITEM.exec(line)
        if (first) {
          const baseIndent = first[1].length
          const ordered = /\d/.test(first[2])
          const items = []
          while (i < lines.length) {
            const item = LIST_ITEM.exec(lines[i])
            if (!item) {
              if (items.length > 0 && /^\s+\S/.test(lines[i])) {
                items[items.length - 1].text += ' ' + lines[i].trim()
                i += 1
                continue
              }
              break
            }
            const indent = item[1].length
            if (indent < baseIndent) break
            if (indent >= baseIndent + 2 && items.length > 0) {
              items[items.length - 1].subs.push(item[3])
              i += 1
              continue
            }
            items.push({ text: item[3], subs: [] })
            i += 1
          }
          blocks.push(h(ordered ? 'ol' : 'ul', { key: keyOf('list') }, items.map((item, index) => h('li', { key: 'i' + index },
            inlineNodes(item.text, 'li' + index),
            item.subs.length === 0 ? null : h('ul', null, item.subs.map((sub, subIndex) => h('li', { key: 's' + subIndex },
              inlineNodes(sub, 'sub' + index + '-' + subIndex))))))))
          continue
        }

        const paragraphLines = []
        while (i < lines.length && !/^\s*$/.test(lines[i])
          && !FENCE.test(lines[i]) && !HEADING.test(lines[i])
          && !/^\s*>/.test(lines[i]) && !LIST_ITEM.test(lines[i])
          && !RULE.test(lines[i])) {
          paragraphLines.push(lines[i])
          i += 1
        }
        if (paragraphLines.length === 0) { i += 1; continue }
        blocks.push(paragraph(paragraphLines, keyOf('p')))
      }

      return blocks
    }

    // ---------------------------------- board data: one pin's shape ---

    /**
     * One stored row, or null when it cannot be shown. `id`, `text` and a known
     * `source` are required; an optional `turn` or `color` that is malformed is
     * dropped rather than trusted, so the turn lookup and the colour picker
     * derive a sound one in its place.
     * @param value - one row as parsed from localStorage.
     * @returns the row with only trustworthy fields, or null.
     */
    function isEntry(value) {
      if (value === null || typeof value !== 'object') return null
      if (typeof value.id !== 'string' || typeof value.text !== 'string') return null
      if (value.source !== 'reply' && value.source !== 'paste') return null
      const row = { ...value }
      if (!(Number.isSafeInteger(row.turn) && row.turn >= 0)) delete row.turn
      if (!/^#[0-9a-f]{6}$/i.test(row.color || '')) delete row.color
      return row
    }

    /**
     * A bright `#rrggbb` at one hue: the last resort, used only once the whole
     * palette is taken, so a pinned row is never left without an ink to paint.
     * @param hue - degrees; wrapped into 0–360.
     * @returns the colour as #rrggbb.
     */
    function hueInk(hue) {
      const at = ((((hue % 360) + 360) % 360) / 60)
      const high = 0.72
      const second = high * (1 - Math.abs(at % 2 - 1))
      const floor = 0.24
      const channels = [[high, second, 0], [second, high, 0], [0, high, second],
        [0, second, high], [second, 0, high], [high, 0, second]][Math.floor(at) % 6]
      return '#' + channels
        .map(value => Math.round((value + floor) * 255).toString(16).padStart(2, '0'))
        .join('')
    }

    /**
     * The hue a row is seeded from: golden-angle steps over its turn keep
     * neighbouring turns far apart, and a row with no turn uses its own id, so
     * the result never depends on where the row sits on the board.
     * @returns the hue in degrees.
     */
    function hueSeed(row) {
      if (Number.isSafeInteger(row.turn) && row.turn >= 0) return row.turn * 137
      let hue = 0
      for (const mark of String(row.messageId || row.id || '')) hue = (hue * 31 + mark.charCodeAt(0)) % 360
      return hue
    }

    /**
     * The colour one row is drawn with: the first bright palette swatch the
     * board is not using yet, else a hue of the caller's own seed once the whole
     * palette is taken, which is never undefined.
     * @param taken - the swatches already in use.
     * @param seed - the hue to fall back on, in degrees.
     * @returns the colour as #rrggbb.
     */
    function pickRailColor(taken, seed) {
      const free = RAIL_COLORS.find(swatch => !taken.has(swatch))
      return free === undefined ? hueInk(seed) : free
    }

    /**
     * The colour each row of one board is drawn with. A row that already stores a
     * colour keeps it. A reply from before colours were stored takes the next free
     * palette swatch, so a legacy pin wears one of the same bright colours a new
     * pin gets rather than a hue of its own; the hand-out walks the colourless
     * rows in their own seed order, never in list order, so prepending a pin does
     * not recolour the pins already there. Past the palette the row falls back to
     * a hue of its own, which is never undefined. A pasted excerpt never reaches
     * the rail, so it spends no swatch.
     * @param rows - the stored rows, newest first.
     * @returns one #rrggbb per reply row, undefined for a paste, in the same order.
     */
    function rowColors(rows) {
      const taken = new Set(rows.map(row => row.color).filter(Boolean))
      const colors = rows.map(row => row.color)
      const uncoloured = rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => !row.color && row.source === 'reply')
        .sort((a, b) => hueSeed(a.row) - hueSeed(b.row)
          || (String(a.row.id) < String(b.row.id) ? -1 : String(a.row.id) > String(b.row.id) ? 1 : 0))
      for (const { row, index } of uncoloured) {
        const color = pickRailColor(taken, hueSeed(row))
        taken.add(color)
        colors[index] = color
      }
      return colors
    }

    // ------------------------------------------------------------ store ---

    /**
     * The colour a new row is pinned with: the first bright palette swatch this
     * board is not using yet, so a pin keeps it for good — deleting another pin
     * cannot recolour it. A board that already uses every hue takes the next one
     * along instead of leaving the row without a colour.
     * @param rows - the board as stored, newest first.
     * @returns the colour as #rrggbb.
     */
    function pinColor(rows) {
      const used = new Set(rows.map(row => row.color))
      return pickRailColor(used, rows.length * 137)
    }

    /**
     * The board's client-side store: entries per Session, mirrored into
     * localStorage so a reload keeps them, with a per-Session listener set so a
     * pin from the conversation updates the open panel and nothing else.
     */
    function createBoard() {
      const cache = new Map()
      const listeners = new Map()

      const keyOf = (sessionId) => STORAGE_PREFIX + String(sessionId)

      /**
       * The rows exactly as stored, validated field by field. A row written
       * before colours were recorded has none here: that is what tells a write
       * that it still has a colour to fill in.
       * @returns the stored rows, newest first.
       */
      function readStored(sessionId) {
        try {
          const raw = window.localStorage.getItem(keyOf(sessionId))
          if (raw) {
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed.map(isEntry).filter(Boolean) : []
          }
          // Pins made under the plugin's old name: take them once and copy them
          // to the current key, so a rename never looks like data loss.
          const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_PREFIX + String(sessionId))
          if (!legacyRaw) return []
          const legacy = JSON.parse(legacyRaw)
          const rows = Array.isArray(legacy) ? legacy.map(isEntry).filter(Boolean) : []
          if (rows.length > 0) window.localStorage.setItem(keyOf(sessionId), JSON.stringify(rows))
          return rows
        } catch (error) {
          return []
        }
      }

      /**
       * The rows a render may use: every reply carries a colour. A row from
       * before colours existed gets the same deterministic one on every read, so
       * the rail never paints `background:undefined`.
       * @returns the stored rows, newest first, each reply with a colour.
       */
      function read(sessionId) {
        const rows = readStored(sessionId)
        const colors = rowColors(rows)
        return rows.map((row, index) => {
          const color = colors[index]
          return row.color || color === undefined ? row : { ...row, color }
        })
      }

      function entries(sessionId) {
        const key = String(sessionId)
        if (!cache.has(key)) cache.set(key, read(key))
        return cache.get(key)
      }

      /** Apply one change in memory, persist it, tell this Session's readers; @returns whether it was stored. */
      function commit(sessionId, next) {
        const key = String(sessionId)
        cache.set(key, next)
        let stored = true
        try {
          window.localStorage.setItem(keyOf(key), JSON.stringify(next))
        } catch (error) {
          stored = false
        }
        const set = listeners.get(key)
        if (set) for (const listener of Array.from(set)) { try { listener() } catch (error) { /* keep others */ } }
        return stored
      }

      return {
        entries,
        /**
         * Prepend one entry, with the colour it will wear from now on. The merge
         * reads the persisted list, not the render cache: a write must never
         * replace entries this page has not loaded yet (a reload between two
         * writes used to be able to drop them).
         */
        add(sessionId, entry) {
          const fresh = read(String(sessionId))
          // A pasted excerpt never reaches the rail, so it does not spend a
          // palette hue the pinned replies can still use.
          const color = entry.color || (entry.source === 'reply' ? pinColor(fresh) : undefined)
          const merged = [{ ...entry, color }, ...fresh.filter((row) => row.id !== entry.id)]
          return commit(sessionId, merged.slice(0, ENTRY_LIMIT))
        },
        /** @returns whether it was stored; a removal of an absent entry writes nothing. */
        remove(sessionId, id) {
          const fresh = read(String(sessionId))
          if (!fresh.some((entry) => entry.id === id)) return true
          return commit(sessionId, fresh.filter((entry) => entry.id !== id))
        },
        backfill(sessionId, turns) {
          // History reads are asynchronous. Merge only missing fields into the
          // latest stored board, never revive deleted pins or replace their text.
          const latest = readStored(sessionId)
          // One palette answer for the whole board, so a backfilled row is
          // stored with the very colour its reads have been showing.
          const colors = rowColors(latest)
          let changed = false
          const next = latest.map((row, index) => {
            const patch = {}
            if (needsTurn(row) && turns.has(row.messageId)) patch.turn = turns.get(row.messageId)
            // A row from before colours were stored gets its own from the shared
            // palette, so a later pin or a deletion cannot recolour it.
            if (!row.color && colors[index] !== undefined) patch.color = colors[index]
            if (Object.keys(patch).length === 0) return row
            changed = true
            return { ...row, ...patch }
          })
          if (changed) commit(sessionId, next)
        },
        clear(sessionId) {
          return commit(sessionId, [])
        },
        subscribe(sessionId, listener) {
          const key = String(sessionId)
          let set = listeners.get(key)
          if (!set) { set = new Set(); listeners.set(key, set) }
          set.add(listener)
          return () => {
            set.delete(listener)
            if (set.size === 0) listeners.delete(key)
          }
        },
      }
    }

    const board = createBoard()

    /** Live entries of one Session. */
    function useEntries(sessionId) {
      const subscribe = React.useCallback((listener) => board.subscribe(sessionId, listener), [sessionId])
      const snapshot = React.useCallback(() => board.entries(sessionId), [sessionId])
      return React.useSyncExternalStore(subscribe, snapshot, snapshot)
    }

    function makeId() {
      return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
    }

    /**
     * The stamp a card shows: the clock alone for today, the date and clock for
     * another day this year, and the year as well once it is not this year.
     * @param time - unix epoch ms.
     * @returns the compact stamp, or an empty string without a usable time.
     */
    function formatStamp(time) {
      if (!Number.isFinite(time)) return ''
      const at = new Date(time)
      const now = new Date()
      const pad = (value) => String(value).padStart(2, '0')
      const clock = pad(at.getHours()) + ':' + pad(at.getMinutes())
      const sameDay = at.getFullYear() === now.getFullYear()
        && at.getMonth() === now.getMonth()
        && at.getDate() === now.getDate()
      if (sameDay) return clock
      const date = pad(at.getMonth() + 1) + '-' + pad(at.getDate())
      return at.getFullYear() === now.getFullYear() ? date + ' ' + clock : at.getFullYear() + '-' + date + ' ' + clock
    }

    /** First non-empty line as a chip-sized title, with its markup marks removed. */
    function titleOf(text) {
      const line = String(text).split('\n').map((row) => row.trim()).find((row) => row.length > 0) || ''
      const plain = line.replace(/^[#>*\-\s]+/, '').replace(/[*_`]/g, '').trim() || line.trim()
      return plain.length > 60 ? plain.slice(0, 60) + '…' : plain
    }

    /**
     * The nodes of a conversation table that carry a finalized reply, in table
     * order. The table is asked defensively: an embedder that offers nothing
     * readable reads as empty rather than throwing into a click handler.
     * @param nodes - the conversation's node table.
     * @returns the finalized nodes, in table order.
     */
    function finalNodes(nodes) {
      try {
        if (!nodes || typeof nodes.values !== 'function') return []
        return Array.from(nodes.values()).filter((node) => node && node.data && node.data.finalNode)
      } catch (error) {
        return []
      }
    }

    /**
     * The conversation's own row for one finalized message. A table that cannot
     * be read is the same answer as a table without the message.
     * @param nodes - the conversation's node table.
     * @param messageId - the message to find.
     * @returns the node, or null when the table does not hold it.
     */
    function nodeForMessage(nodes, messageId) {
      const node = finalNodes(nodes).find((row) => row.data.finalNode.messageId === messageId)
      return node === undefined ? null : node
    }

    /** One finalized assistant reply: its readable text, its turn and the time it was written. */
    function replySnapshot(nodes, messageId) {
      const node = nodeForMessage(nodes, messageId)
      if (node === null) return null
      const data = node.data
      const finalNode = data.finalNode
      const blocks = Array.isArray(finalNode.blocks) ? finalNode.blocks : []
      const text = blocks
        .filter((block) => block && block.kind === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n\n')
        .trim()
      if (text === '') return null
      return { text, turn: data.turn, time: Number.isFinite(data.time) ? data.time : undefined }
    }

    /** Put text on the clipboard; @returns whether the browser accepted it. */
    function copyText(text) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          return Promise.resolve(navigator.clipboard.writeText(text)).then(() => true, () => false)
        }
      } catch (error) {
        return Promise.resolve(false)
      }
      return Promise.resolve(false)
    }

    /** One transient line of feedback beside the panel's controls. */
    function useNote() {
      const [note, setNote] = React.useState(null)
      const timer = React.useRef(0)
      const stop = () => { if (timer.current) { clearTimeout(timer.current); timer.current = 0 } }
      const show = React.useCallback((text, failed) => {
        setNote({ text, failed: failed === true })
        stop()
        timer.current = setTimeout(() => { setNote(null); timer.current = 0 }, 6000)
      }, [])
      // Drop the line on demand. The icon's bubble keeps a click's feedback up
      // for the six-second timeout even after the pointer leaves, so this is
      // only for a caller that wants the line gone at once.
      const hide = React.useCallback(() => { stop(); setNote(null) }, [])
      React.useEffect(() => () => { stop() }, [])
      return [note, show, hide]
    }

    // ----------------------- reply actions: the icon row ---

    /**
     * The reply action row's geometry, taken from the host's own action buttons
     * (28px square, 17px glyph, tertiary ink, hover surface) so the pin sits in
     * the row as one more icon.
     */
    const actionStyle = {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 'calc(28px + var(--dsh-content-font-delta, 0px))',
      height: 'calc(28px + var(--dsh-content-font-delta, 0px))',
      padding: '6px', border: 'none', borderRadius: 'var(--dsw-radius-sm, 8px)',
      background: 'transparent', color: 'var(--dsw-alias-label-tertiary)', cursor: 'pointer',
    }

    const actionHoverStyle = {
      background: 'var(--dsw-alias-interactive-bg-hover, var(--dsw-alias-bg-layer-2))',
      color: 'var(--dsw-alias-label-secondary)',
    }

    /**
     * The bubble's look, placed by the caller: it floats above the icon, so it
     * must not be clipped by the message flow or painted under the composer.
     */
    const BUBBLE_LOOK = {
      zIndex: 2147483000,
      // Size from the bubble's own text, not from the 28px button it hangs off:
      // shrink-to-fit against such a narrow box wraps one glyph per line.
      width: 'max-content', maxWidth: '260px', padding: '4px 8px',
      borderRadius: 'var(--dsw-radius-sm, 8px)', border: '1px solid var(--dsw-alias-border-l2)',
      background: 'var(--dsw-alias-bg-overlay)', color: 'var(--dsw-alias-label-primary)',
      fontSize: '12px', lineHeight: '18px', whiteSpace: 'normal', textAlign: 'left',
      boxShadow: 'var(--dsw-elevation-panel, 0 6px 20px rgba(0,0,0,.18))', pointerEvents: 'none',
    }

    /** React DOM for the portal that keeps the bubble above every host layer. */
    const ReactDOM = (() => {
      try { return require('react-dom') } catch (error) { return null }
    })()
    const CAN_PORTAL = !!(ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined')

    /**
     * The two halves of one action's copy, decided in one place: the glyph it
     * draws and the label it shows. A star keeps the pin without opening the
     * column; an arrow always opens it, pinned or not.
     * @param variant - 'star' or 'arrow'.
     * @param saved - whether this reply is already on the board.
     * @returns the glyph and the copy key behind it.
     */
    function actionLook(variant, saved) {
      if (variant === 'star') return { glyph: StarGlyph, label: saved ? 'save.starred' : 'save.quiet' }
      // A bookmark and an arrow say the same thing; only the glyph differs.
      return { glyph: variant === 'bookmark' ? BookmarkGlyph : ArrowGlyph, label: saved ? 'save.open' : 'save.action' }
    }

    /**
     * One icon-row button: a 28px square whose label appears under it on hover,
     * the same place the row's shipped tooltips put theirs.
     * @param props - variant, label, click handler, optional transient note.
     * @returns the button and, while shown, its floating bubble.
     */
    function IconAction(props) {
      const [hover, setHover] = React.useState(false)
      const [at, setAt] = React.useState(null)
      // Whether the pointer is resting on the icon, bubble or no bubble. A scroll
      // can take the bubble away while the pointer stays put, and then no
      // `mouseenter` follows when the icon comes back into view.
      const [pointing, setPointing] = React.useState(false)
      const btnRef = React.useRef(null)
      const timer = React.useRef(0)
      const note = props.note
      // The bubble carries two things: the label the pointer asks for, and a
      // note a click leaves behind. The label still belongs to the pointer
      // alone; the note outlives the hover and runs to its own six-second
      // timeout, so a pin's "saved" feedback stays readable after the mouse
      // moves on.
      const visible = hover || note != null

      /**
       * Anchor the bubble to the button's box in viewport coordinates. It hangs
       * below the icon like the rest of the row's tooltips, and flips above only
       * when the viewport has no room under it.
       */
      const measure = React.useCallback(() => {
        const node = btnRef.current
        if (!node || typeof node.getBoundingClientRect !== 'function') return
        const rect = node.getBoundingClientRect()
        const needed = props.note ? 68 : 36
        const below = window.innerHeight - rect.bottom >= needed
        setAt({
          left: Math.round(rect.left + rect.width / 2),
          top: Math.round(below ? rect.bottom + 8 : rect.top - 8),
          below,
        })
      }, [props.note])

      React.useEffect(() => {
        // Listen while the bubble is up, and while the pointer is on an icon the
        // scroll can carry out of view and back again.
        if (!visible) setAt(null)
        if (!visible && !pointing) return undefined
        if (visible) measure()
        /**
         * Follow the button. A scroll can carry the icon out from under a still
         * pointer, and then no `mouseleave` ever fires: when the button's whole
         * box is outside the viewport the bubble leaves by the same path as the
         * pointer instead of staying parked at its last measured position, and
         * it comes back by that same path once the icon is in view again without
         * waiting out the dwell a second time.
         */
        const follow = () => {
          const node = btnRef.current
          if (node && typeof node.getBoundingClientRect === 'function') {
            const rect = node.getBoundingClientRect()
            // A click's note is still up here, so the bubble leaves the screen
            // with the icon rather than parked at its last measured position.
            if (rect.bottom < 0 || rect.top > window.innerHeight) { dismiss(); setAt(null); return }
            // Back in view with the pointer still on the icon: the bubble
            // returns at once, unless the dwell has not run yet anyway.
            if (!visible && pointing && timer.current === 0) { setHover(true); return }
          }
          if (visible) measure()
        }
        /** A hidden tab is not a hover: the bubble goes with the pointer too. */
        const onVisibility = () => { if (document.visibilityState === 'hidden') dismiss() }
        window.addEventListener('scroll', follow, true)
        window.addEventListener('resize', follow)
        document.addEventListener('visibilitychange', onVisibility)
        return () => {
          window.removeEventListener('scroll', follow, true)
          window.removeEventListener('resize', follow)
          document.removeEventListener('visibilitychange', onVisibility)
        }
      }, [visible, pointing, measure])

      React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

      // A short dwell before the label appears: sweeping the pointer across the
      // row should not flash a bubble out of every icon.
      const enter = () => {
        setPointing(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => { timer.current = 0; setHover(true) }, 260)
      }
      /** Take the hover label away; a click's note keeps its own timeout. */
      const dismiss = () => {
        if (timer.current) { clearTimeout(timer.current); timer.current = 0 }
        setHover(false)
      }
      const leave = () => { setPointing(false); dismiss() }

      // A click's note wins over the hover label while it lasts, and stays on
      // screen whether the pointer is on the icon or not.
      const text = note ? note.text : (hover ? props.label : null)
      const look = note && note.failed
        ? Object.assign({}, BUBBLE_LOOK, { color: 'var(--dsw-alias-state-error-primary)' })
        : BUBBLE_LOOK
      // Portalled to the body: a fixed bubble inside the message row would be
      // clipped by the flow and painted under the composer, which is exactly the
      // row this icon sits next to. Without a portal it falls back to a plain
      // absolute bubble above the icon rather than losing the label.
      let bubble = null
      if (text !== null) {
        if (CAN_PORTAL && at !== null) {
          bubble = ReactDOM.createPortal(h('span', {
            style: Object.assign({}, look, {
              position: 'fixed', left: at.left, top: at.top,
              transform: at.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            }),
          }, text), document.body)
        } else if (!CAN_PORTAL) {
          bubble = h('span', {
            style: Object.assign({}, look, {
              position: 'absolute', left: '50%', bottom: 'calc(100% + 8px)', transform: 'translateX(-50%)',
            }),
          }, text)
        }
      }

      return h('span', { style: { position: 'relative', display: 'inline-flex', alignItems: 'center' } },
        h('button', {
          type: 'button',
          ref: btnRef,
          'aria-label': props.label,
          onClick: props.onClick,
          onMouseEnter: enter,
          onMouseLeave: leave,
          onFocus: () => { setHover(true) },
          onBlur: leave,
          style: hover ? Object.assign({}, actionStyle, actionHoverStyle) : actionStyle,
        }, h(actionLook(props.variant, props.saved).glyph, { size: 17, filled:props.saved })),
        bubble,
      )
    }

    // ------------------------------ panel: the right column ---

    /**
     * Ask about one excerpt: quote it into the Session composer, so the question
     * and the text it is about reach the model in one message. When the composer
     * refuses (another submission in flight), the same text goes to the clipboard
     * instead and the note says so.
     */
    function askAbout(inputActions, text, limit, t, show, onQuoted) {
      const body = String(text == null ? '' : text).trim()
      if (!body) return
      const clipped = body.length > limit
      const payload = clipped ? body.slice(0, limit) + t('quote.suffix') : body
      let accepted = false
      try {
        if (inputActions && typeof inputActions.insertQuote === 'function') {
          accepted = inputActions.insertQuote(payload) === true
        }
      } catch (error) {
        accepted = false
      }
      if (accepted) {
        show(clipped ? t('note.quotedClipped') : t('note.quoted'), false)
        if (onQuoted) onQuoted()
        return
      }
      copyText(payload).then((copied) => {
        show(copied ? t('note.copiedForAsk') : t('note.copyFailed'), !copied)
      })
    }

    /** The right column's content: pins of this Session, and the way back into the chat. */
    function ReaderPanel(props) {
      const t = props.t
      const sessionId = props.sessionId
      const entries = useEntries(sessionId)
      // A pin whose turn stayed unknown reads one grey line, not a silent gap.
      const unresolvedVersion = useUnresolvedVersion()
      const [composing, setComposing] = React.useState(false)
      const [draft, setDraft] = React.useState('')
      const [folded, setFolded] = React.useState([])
      const [pick, setPick] = React.useState(null)
      const [confirmClear, setConfirmClear] = React.useState(false)
      const [note, showNote] = useNote()
      // The chat's own node table: the jump needs the anchor key of a message,
      // which only the conversation knows.
      const chatNodes = props.useChat((snapshot) => snapshot.nodes)
      const rootRef = React.useRef(null)
      const pillRef = React.useRef(null)
      const clearTimer = React.useRef(0)

      React.useEffect(() => () => { if (clearTimer.current) clearTimeout(clearTimer.current) }, [])

      // Parse each pin once per change: a selection drag re-renders this panel on
      // every selectionchange, and re-parsing a long reply each time would stutter.
      const rendered = React.useMemo(
        () => entries.map((entry) => ({
          entry,
          blocks: mdBlocks(entry.text),
          stamp: formatStamp(entry.time),
          // Resolved against the in-memory mark, so a pin the history could not
          // place explains its missing rail marker instead of hiding the fact.
          turnUnresolved: needsTurn(entry) && isTurnUnresolved(sessionId, entry.messageId),
        })),
        [entries, sessionId, unresolvedVersion],
      )

      // Opening the column is another chance to resolve what the header could
      // not: the lookup itself is shared per Session, so this cannot pile up.
      useRecoverTurns(sessionId, entries, props.recover)

      /** The live selection inside this panel, and where to float its action. */
      const readPick = React.useCallback(() => {
        try {
          const active = window.getSelection()
          if (!active || active.isCollapsed || active.rangeCount === 0) return null
          const root = rootRef.current
          const anchor = active.anchorNode
          if (!root || !anchor || !root.contains(anchor)) return null
          const text = active.toString().trim()
          if (text.length < 2) return null
          const rect = active.getRangeAt(0).getBoundingClientRect()
          if (!rect || (rect.width === 0 && rect.height === 0)) return null
          const below = rect.top < 64
          return {
            text,
            left: Math.round(Math.min(Math.max(rect.left + rect.width / 2, 72), window.innerWidth - 72)),
            top: Math.round(below ? rect.bottom + 8 : rect.top - 8),
            below,
          }
        } catch (error) {
          return null
        }
      }, [])

      // The action appears once the gesture ENDS, not while the pointer is still
      // dragging: a release (or a keyboard selection) is what settles a passage.
      React.useEffect(() => {
        const refresh = () => { setPick(readPick()) }
        /** A press elsewhere drops the pill; a press on the pill must survive to its click. */
        const hide = (event) => {
          const pill = pillRef.current
          if (pill !== null && event && typeof event.composedPath === 'function'
            && event.composedPath().includes(pill)) return
          setPick(null)
        }
        /** Reposition an already shown pill, and drop it when the selection dies. */
        const follow = () => {
          setPick((current) => (current === null ? current : readPick()))
        }
        const onKeyUp = (event) => {
          if (event.key === 'Shift' || event.shiftKey || event.key === 'a' || event.key === 'A') refresh()
        }
        document.addEventListener('pointerdown', hide, true)
        document.addEventListener('pointerup', refresh, true)
        document.addEventListener('keyup', onKeyUp, true)
        document.addEventListener('selectionchange', follow)
        window.addEventListener('scroll', follow, true)
        window.addEventListener('resize', follow)
        return () => {
          document.removeEventListener('pointerdown', hide, true)
          document.removeEventListener('pointerup', refresh, true)
          document.removeEventListener('keyup', onKeyUp, true)
          document.removeEventListener('selectionchange', follow)
          window.removeEventListener('scroll', follow, true)
          window.removeEventListener('resize', follow)
        }
      }, [readPick])

      const toggleFold = (id) => {
        setFolded((current) => current.includes(id) ? current.filter((row) => row !== id) : [...current, id])
      }

      const saveDraft = () => {
        const text = draft.trim()
        if (!text) return
        const stored = board.add(sessionId, { id: makeId(), title: titleOf(text), text, source: 'paste', time: Date.now() })
        setDraft('')
        setComposing(false)
        showNote(stored ? t('note.saved') : t('note.storageFailed'), !stored)
      }

      const copyEntry = (entry) => {
        copyText(entry.text).then((copied) => {
          showNote(copied ? t('note.copied') : t('note.copyFailed'), !copied)
        })
      }

      const clearAll = () => {
        if (!confirmClear) {
          setConfirmClear(true)
          if (clearTimer.current) clearTimeout(clearTimer.current)
          clearTimer.current = setTimeout(() => { setConfirmClear(false); clearTimer.current = 0 }, 4000)
          return
        }
        if (clearTimer.current) { clearTimeout(clearTimer.current); clearTimer.current = 0 }
        setConfirmClear(false)
        setFolded([])
        if (!board.clear(sessionId)) showNote(t('note.storageFailed'), true)
      }

      /**
       * Scroll the conversation to the message a pin came from. The chat marks
       * every row with its anchor key, so the jump is a lookup plus a scroll;
       * a row outside the loaded window simply is not there to find. When it has
       * to be paged in, the walk ends in one of three ways and the notice says
       * which: the row appeared, the conversation's start was reached without it,
       * or the walk ran out of budget (time, pages, a stalled column) before that
       * could be settled.
       * @param {{ messageId?: string }} entry - the pin whose message should be revealed.
       * @returns {void}
       */
      const jumpTo = (entry) => {
        if (typeof entry.messageId !== 'string' || entry.messageId === '') return
        /** The conversation's own key for this message, once the chat knows it. */
        const anchorKey = () => {
          const node = nodeForMessage(chatNodes, entry.messageId)
          return node !== null && typeof node.key === 'string' ? node.key : ''
        }
        /** Scroll to the row, or null while it is not mounted. */
        const reveal = (behavior) => {
          const key = anchorKey()
          if (key === '') return null
          const row = document.querySelector('[data-chat-anchor-key="' + key.replace(/["\\]/g, '\\$&') + '"]')
          if (row === null || typeof row.scrollIntoView !== 'function') return null
          row.scrollIntoView({ block: 'center', inline: 'nearest', behavior })
          return row
        }
        /** The conversation's own "load older" control, while it is still clickable. */
        const olderControl = () => document.querySelector('[data-chat-history] button:not([disabled])')
        /** Pull one page of older history; false when there is none left to pull. */
        const loadOlder = () => {
          const button = olderControl()
          if (button === null) return false
          button.click()
          return true
        }
        /**
         * The walk gave up before it could prove it reached the conversation's
         * start: say how far it got, and claim nothing about the start.
         * @param {number} pages - pages pulled so far.
         * @returns {void}
         */
        const incomplete = (pages) => {
          // The copy carries a plain token; `t` is a plain lookup, so the count is
          // filled in here rather than passed as an argument.
          showNote(t('note.jumpIncomplete').split('{pages}').join(String(pages)), true)
        }

        const settle = (row) => {
          // A running turn keeps pulling the column to its tail; assert the jump
          // once more after that follow settles.
          setTimeout(() => { try { row.scrollIntoView({ block: 'center', inline: 'nearest' }) } catch (error) { /* gone */ } }, 260)
        }

        const found = reveal('smooth')
        if (found !== null) { settle(found); return }

        // The row is simply not paged in yet: walk the history backwards through
        // the conversation's own "load older" control until it appears, then stop.
        showNote(t('note.jumping'), false)
        const deadline = Date.now() + JUMP_BUDGET_MS
        let pages = 0
        let seen = -1
        let stalls = 0
        const step = () => {
          const row = reveal('instant')
          if (row !== null) { settle(row); return }
          let count = 0
          try { count = chatNodes.values().length } catch (error) { count = seen }
          // A page usually mounts more slowly than one sample, so a flat count only
          // counts towards a stall while the control is still there to click.
          if (count === seen && olderControl() !== null) stalls += 1
          else { stalls = 0; seen = count }
          if (Date.now() > deadline || pages >= JUMP_PAGE_LIMIT || stalls >= JUMP_STALL_LIMIT) {
            incomplete(pages)
            return
          }
          if (!loadOlder()) {
            // Nothing left to click: the conversation's start sits behind the
            // loaded window, so the message really is not in it.
            showNote(t('note.jumpMissing'), true)
            return
          }
          pages += 1
          setTimeout(step, JUMP_STEP_MS)
        }
        setTimeout(step, 160)
      }

      /** Hand one picked passage to the composer and drop the selection. */
      const quotePicked = (text) => {
        setPick(null)
        askAbout(props.inputActions, text, QUOTE_LIMIT_PASTE, t, showNote, () => {
          try { window.getSelection().removeAllRanges() } catch (error) { /* nothing to clear */ }
          setPick(null)
        })
      }

      const pill = pick === null || !CAN_PORTAL ? null : ReactDOM.createPortal(h('button', {
        type: 'button',
        ref: pillRef,
        className: 'akr-pick',
        style: {
          left: pick.left,
          top: pick.top,
          transform: pick.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        },
        // Hold the selection through the press: without this the browser drops it
        // before the click handler runs.
        onPointerDown: (event) => { event.preventDefault() },
        onClick: () => { quotePicked(pick.text) },
      }, h(ArrowGlyph, { size: 13 }), h('span', null, t('pick.action'))), document.body)

      return h('div', { className: 'akr-root', ref: rootRef },
        h(Styles),
        h('div', { className: 'akr-head' },
          h('span', { className: 'akr-head-title' }, t('tab.title')),
          entries.length > 0 ? h('span', { className: 'akr-head-meta' }, entries.length + ' ' + t('unit.entries')) : null,
          h('span', { className: 'akr-spacer' }),
          entries.length > 0
            ? h('button', { type: 'button', className: 'akr-btn', onClick: clearAll },
                t(confirmClear ? 'clear.confirm' : 'clear'))
            : null,
        ),
        entries.length === 0
          ? h('div', { className: 'akr-empty' },
              h('span', { className: 'akr-empty-title' }, t('empty.title')),
              h('span', null, t('empty.hint')),
            )
          : h('div', { className: 'akr-list' },
              rendered.map(({ entry, blocks, stamp, turnUnresolved }) => {
                // Every pin reads in full on arrival; folding is the exception.
                const open = !folded.includes(entry.id)
                return h('div', { className: 'akr-card', key: entry.id },
                  h('div', { className: 'akr-card-head' },
                    h('span', { className: 'akr-tag' }, t(entry.source === 'paste' ? 'source.paste' : 'source.reply')),
                    h('span', { className: 'akr-card-title', title: entry.title }, entry.title),
                    stamp === '' ? null : h('span', { className: 'akr-time' }, stamp),
                  ),
                  h('div', {
                    className: 'akr-body akr-md' + (open ? ' akr-body-open' : ''),
                  }, blocks),
                  turnUnresolved ? h('div', { className: 'akr-card-note' }, t('note.noTurn')) : null,
                  h('div', { className: 'akr-card-foot' },
                    entry.source === 'paste'
                      ? null
                      : h('button', {
                          type: 'button', className: 'akr-btn',
                          title: t('action.jump'),
                          onClick: () => { jumpTo(entry) },
                        }, t('action.jump')),
                    h('button', {
                      type: 'button', className: 'akr-btn akr-btn-strong',
                      onClick: () => {
                        askAbout(props.inputActions, entry.text,
                          entry.source === 'paste' ? QUOTE_LIMIT_PASTE : QUOTE_LIMIT_REPLY, t, showNote)
                      },
                    }, t('action.ask')),
                    h('span', { className: 'akr-spacer' }),
                    h('button', { type: 'button', className: 'akr-btn', onClick: () => { toggleFold(entry.id) } },
                      open ? t('action.collapse') : t('action.expand')),
                    h('button', { type: 'button', className: 'akr-btn', onClick: () => { copyEntry(entry) } }, t('action.copy')),
                    h('button', {
                      type: 'button', className: 'akr-btn',
                      onClick: () => { board.remove(sessionId, entry.id) },
                    }, t('action.remove')),
                  ),
                )
              }),
            ),
        composing
          ? h('div', { className: 'akr-compose' },
              h('textarea', {
                className: 'akr-input',
                value: draft,
                placeholder: t('compose.placeholder'),
                spellCheck: false,
                onChange: (event) => { setDraft(event.target.value) },
              }),
              h('div', { className: 'akr-row' },
                h('button', { type: 'button', className: 'akr-btn akr-btn-strong', disabled: draft.trim().length === 0, onClick: saveDraft },
                  t('compose.save')),
                h('button', { type: 'button', className: 'akr-btn', onClick: () => { setComposing(false); setDraft('') } },
                  t('compose.cancel')),
              ),
            )
          : h('div', { className: 'akr-row' },
              h('button', { type: 'button', className: 'akr-btn', onClick: () => { setComposing(true) } },
                '+ ' + t('compose.toggle')),
            ),
        note ? h('div', { className: 'akr-note' + (note.failed ? ' akr-note-error' : '') }, note.text) : null,
        pill,
      )
    }

    // ---------------------- reply actions: the pin button ---

    /** The icon under one finalized reply: pin it, then show the board. */
    function SaveAction(props) {
      const t = props.t
      const star = props.variant === 'star'
      const entries = useEntries(props.sessionId)
      // A reply is pinned at most once, and the star reads that pin back so its
      // second click can take the reply off again. Older boards may hold more
      // than one row for the same message, so the star clears all of them.
      const own = entries.filter((entry) => entry.messageId === props.messageId)
      const saved = own.length > 0
      const nodes = props.useChat((snapshot) => snapshot.nodes)
      const [note, showNote, dismissNote] = useNote()

      const onClick = () => {
        if (saved) {
          // The arrow still reveals the column. The star toggles in place, so
          // unpinning opens nothing and that turn's rail marker returns to the
          // native tick on its own, because the rules read the board.
          if (!star) {
            props.openPanel()
            showNote(t('note.alreadySaved'), false)
            return
          }
          let stored = true
          for (const entry of own) {
            if (!board.remove(props.sessionId, entry.id)) stored = false
          }
          showNote(stored ? t('note.unpinned') : t('note.storageFailed'), !stored)
          return
        }
        const snapshot = replySnapshot(nodes, props.messageId)
        if (snapshot === null) { showNote(t('save.empty'), true); return }
        const stored = board.add(props.sessionId, {
          id: makeId(), title: titleOf(snapshot.text), text: snapshot.text, source: 'reply',
          messageId: props.messageId, turn: snapshot.turn, time: snapshot.time === undefined ? Date.now() : snapshot.time,
        })
        if (!star) props.openPanel()
        showNote(stored ? t('note.saved') : t('note.storageFailed'), !stored)
      }

      return h(IconAction, {
        variant: props.variant, saved,
        label: t(actionLook(props.variant, saved).label),
        onClick,
        note,
        // Kept for callers that want the line gone early; leaving the icon no
        // longer routes here, so a click's note keeps its six-second timeout.
        onDismiss: dismissNote,
      })
    }

    // --------- settings: the palette, the rail preferences, their panel ---

    // One native rail button per turn, not per reply. Style its existing tick,
    // never its hit area, handlers or virtual-list position.
    // Profile-wide appearance only. Never store these preferences in a board.
    const PREF_KEY = 'dsh-pin-bookmarks:rail-settings:v1'
    /** The preference key from before the rename. */
    const LEGACY_PREF_KEY = 'dsh-ask-reader:rail-settings:v1'
    const PREF_EVENT = 'ask-reader:rail-settings-changed'
    const DEFAULT_PREFS = { uniformColor: false, color: '#a78bfa', uniformLength: true, width: RAIL_DEFAULT_WIDTH }
    /** The preference JSON as stored, or an empty string when storage refuses to answer. */
    const prefsRaw = () => {
      try {
        const raw = window.localStorage.getItem(PREF_KEY)
        if (raw) return raw
        return window.localStorage.getItem(LEGACY_PREF_KEY) || ''
      } catch { return '' }
    }
    /** One preference record with every field of a known type, clamped into range. */
    function normalizePrefs(value) {
      const p = value || {}
      return {
        uniformColor: p.uniformColor === true,
        color: /^#[0-9a-f]{6}$/i.test(p.color || '') ? p.color.toLowerCase() : DEFAULT_PREFS.color,
        uniformLength: p.uniformLength !== false,
        width: Number.isFinite(p.width) ? Math.max(RAIL_MIN, Math.min(RAIL_MAX, Math.round(p.width))) : DEFAULT_PREFS.width,
      }
    }
    /** Parse stored preference JSON; anything unreadable reads as the defaults. */
    function decodePrefs(raw) {
      try { return normalizePrefs(JSON.parse(raw)) } catch { return DEFAULT_PREFS }
    }
    /** Merge one change into the stored preferences, tell this window; @returns whether it was stored. */
    function writePrefs(change) {
      try {
        window.localStorage.setItem(PREF_KEY, JSON.stringify(normalizePrefs({ ...decodePrefs(prefsRaw()), ...change })))
      } catch { return false }
      window.dispatchEvent(new Event(PREF_EVENT))
      return true
    }
    /** Subscribe to preference changes here and, through `storage`, in the app's other windows. */
    function subscribePrefs(fn) {
      const crossWindow = e => { if (e.key === PREF_KEY || e.key === LEGACY_PREF_KEY || e.key === null) fn() }
      window.addEventListener(PREF_EVENT, fn)
      window.addEventListener('storage', crossWindow)
      return () => { window.removeEventListener(PREF_EVENT, fn); window.removeEventListener('storage', crossWindow) }
    }
    /** The live appearance preferences of this device. */
    function useRailPrefs() {
      const raw = React.useSyncExternalStore(subscribePrefs, prefsRaw, prefsRaw)
      return React.useMemo(() => decodePrefs(raw), [raw])
    }
    /** A 32-bit hash of a pin's own id, so its length never depends on its neighbours; @returns 0 … 2^32-1. */
    function railSeed(key) {
      let hash = 0
      for (const mark of String(key === undefined ? '' : key)) hash = (hash * 31 + mark.charCodeAt(0)) >>> 0
      return hash
    }
    // The native hit area is 28px and the longest native (active) tick is
    // 20px. Keep every width visibly above that without enlarging the button.
    /**
     * The width one pinned tick is drawn at. A non-uniform rail cycles the steps
     * off the pin's own identity — its row id, else its stored colour — so
     * deleting another pin cannot re-lay the widths of the survivors.
     */
    const railWidth = (prefs, key) => prefs.uniformLength
      ? prefs.width
      : RAIL_STEPS[railSeed(key) % RAIL_STEPS.length]

    // Only the two reading-board preferences use this switch skin; retain the
    // native checkbox input for its label target, keyboard and checked state.
    const SWITCH_CSS = `
      input.akr-rail-switch {
        appearance:none; -webkit-appearance:none; position:relative; display:inline-block;
        flex:0 0 36px; width:36px; height:20px; box-sizing:border-box; margin:0;
        padding:0; border:1px solid var(--dsw-alias-border-l2,#c9ced8); border-radius:8px;
        background:var(--dsw-alias-bg-layer-2,#e9ecf2); cursor:pointer;
        transition:background-color 140ms ease;
      }
      input.akr-rail-switch::before {
        content:""; position:absolute; top:3px; left:3px; width:14px; height:14px;
        border-radius:5px; background:var(--dsw-alias-label-secondary,#61666b); transform:translateX(0);
        transition:transform 140ms ease,background-color 140ms ease;
      }
      input.akr-rail-switch:checked {background:var(--dsw-alias-brand-primary,#565d68);border-color:var(--dsw-alias-brand-primary,#565d68)}
      input.akr-rail-switch:checked::before {transform:translateX(16px);background:var(--dsw-alias-bg-base,#f7f8fa)}
      input.akr-rail-switch:focus-visible {outline:2px solid var(--dsw-focus-ring-color,#1875e2);outline-offset:3px}
      @media (prefers-reduced-motion:reduce){input.akr-rail-switch,input.akr-rail-switch::before{transition:none}}
      @media (forced-colors:active){
        input.akr-rail-switch{forced-color-adjust:none;background:GrayText}
        input.akr-rail-switch:checked{background:Highlight}
        input.akr-rail-switch::before{background:Canvas}
        input.akr-rail-switch:checked::before{background:HighlightText}
      }
    `
    /** Settings → Bookmarks: the two appearance switches and a live preview of the rail. */
    function RailSettings({ t }) {
      const prefs = useRailPrefs()
      const [failed, setFailed] = React.useState(false)
      const set = patch => setFailed(!writePrefs(patch))
      const rowStyle = { display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, padding:'14px 0', borderBottom:'1px solid var(--dsw-alias-border-l2, #8884)' }
      const hint = { display:'block', fontSize:12, color:'var(--dsw-alias-label-secondary)', marginTop:4 }
      const row = (title, detail, control) => h('label', {style:rowStyle},
        h('span', null, h('strong', null, t(title)), detail && h('small', {style:hint}, t(detail))), control)
      const toggle = (key, title, detail) => row(title, detail, h('input', {
        type:'checkbox', role:'switch', className:'akr-rail-switch', name:key, checked:prefs[key], 'aria-label':t(title),
        onChange:e=>set({[key]:e.target.checked}),
      }))
      const tick = (w, color, thick) => h('i', { 'aria-hidden':true, style:{
        display:'inline-block', flex:'none', width:w, height:thick, background:color, borderRadius:4,
      }})
      // The preview shows the cycle itself, so its four marks step through the
      // lengths a pin can wear rather than hashing four sample identities.
      const demoWidth = i => prefs.uniformLength ? prefs.width : RAIL_STEPS[i % RAIL_STEPS.length]
      const demo = (title, marks) => h('div', {style:{display:'flex', alignItems:'center', justifyContent:'space-between', gap:12}},
        h('span', null, t(title)), h('span', {style:{display:'grid',justifyItems:'end',gap:6,width:32}}, ...marks))
      return h('section', {style:{maxWidth:600, padding:'8px 12px', color:'var(--dsw-alias-label-primary)'}},
        h('style', null, SWITCH_CSS),
        h('h2', {style:{margin:'0 0 4px'}}, t('rail.heading')),
        h('p', {style:{...hint,marginBottom:12}}, t('rail.intro')),
        toggle('uniformColor','rail.uniformColor','rail.colorHint'),
        prefs.uniformColor && row('rail.color', null, h('input', {
          type:'color', name:'color', value:prefs.color, 'aria-label':t('rail.color'), onChange:e=>set({color:e.target.value}),
        })),
        toggle('uniformLength','rail.uniformLength','rail.lengthHint'),
        prefs.uniformLength && row('rail.width', null, h('span', {style:{display:'flex',alignItems:'center',gap:8}},
          h('input', {type:'range',name:'width',min:RAIL_MIN,max:RAIL_MAX,step:1,value:prefs.width,'aria-label':t('rail.width'),
            onChange:e=>set({width:Number(e.target.value)})}), h('output', null, prefs.width + ' px'))),
        h('div', {style:{marginTop:18,padding:14,border:'1px solid var(--dsw-alias-border-l2, #8884)',borderRadius:10,display:'grid',gap:12}},
          h('strong', null, t('rail.preview')),
          demo('rail.ordinary', [tick(RAIL_TICK_WIDTH,'var(--dsw-alias-label-secondary,#888)',RAIL_TICK_HEIGHT)]),
          demo('rail.pinned', [0,1,2,3].map(i=>tick(demoWidth(i),prefs.uniformColor ? prefs.color : RAIL_COLORS[i],RAIL_PINNED_HEIGHT)))),
        failed && h('p',{role:'alert'},t('rail.failed')))
    }

    /**
     * One attribute value for a selector, quoted and escaped by the platform's
     * own escaper: the browser this client runs in always offers `CSS.escape`.
     * @returns the quoted, escaped attribute value.
     */
    function cssAttr(value) {
      return '"' + window.CSS.escape(String(value)) + '"'
    }

    // ---------------- host rail css: the rules painted on the native rail ---

    /**
     * The selectors that point at one turn's mark. Two independent spellings are
     * emitted: the template read off the live rail (locale-proof, works even when
     * the host dictionary is not available to this plugin) and the plugin's own
     * copy of the host label (works when the rail is not painted yet).
     * @param dom - the rail this Session painted.
     * @returns distinct `button[data-index][aria-label=...]` selectors, possibly empty.
     */
    function railTargets(dom, turn, chatT) {
      const out = []
      const add = selector => { if (!out.includes(selector)) out.push(selector) }
      for (const [prefix, suffix] of dom.templates) {
        add(dom.scope + ' button[data-index][aria-label=' + dom.attr(prefix + turn + suffix) + ']')
      }
      for (const key of ['jump', 'jumpLoad']) {
        const label = chatT('chat.turnNavigation.' + key, { turn })
        // A locale that is not bound yet answers with the key itself; a rule built
        // from that can never match, so it is not worth writing.
        if (typeof label === 'string' && label !== '' && !label.startsWith('chat.')) {
          add(dom.scope + ' button[data-index][aria-label=' + dom.attr(label) + ']')
        }
      }
      return out
    }

    /**
     * How the host spells "turn N" on the rail: each mark's aria-label is that
     * template with its own number filled in. Read from the marks on screen, so
     * the pin rules never depend on this plugin's copy of the chat dictionary.
     * @returns [prefix, suffix] pairs; empty when the rail is not on screen.
     */
    function railLabelTemplates(scope) {
      let marks
      try { marks = document.querySelectorAll(scope + ' button[data-index][aria-label]') } catch (error) { return [] }
      const seen = new Map()
      for (const mark of marks) {
        const label = mark.getAttribute('aria-label') || ''
        // One number only: anything else is not a turn template we can rebuild.
        const runs = label.match(/\d+/g)
        if (!runs || runs.length !== 1) continue
        const at = label.indexOf(runs[0])
        const prefix = label.slice(0, at)
        const suffix = label.slice(at + runs[0].length)
        seen.set(prefix + '\u0000' + suffix, [prefix, suffix])
      }
      return Array.from(seen.values())
    }

    /**
     * This Session's rail, read once per render: the scope selector that keeps a
     * rule inside one conversation, the attribute escaper the rule is built
     * with, and the label templates the painted marks teach us.
     * @returns the scope, the escaper and the [prefix, suffix] templates.
     */
    function railDom(sessionId) {
      const attr = cssAttr
      const scope = '[data-conversation-session=' + attr(sessionId) + '] nav'
      // One DOM read per render, shared by every pinned turn.
      return { scope, attr, templates: railLabelTemplates(scope) }
    }

    /**
     * The turns this board marks on the rail, oldest first, each with the colour
     * its row was pinned with and the row's own id, so a marker's length can be
     * taken from the pin rather than from its place in this list. This is the
     * only place that reads a chat node's turn, so the rule builder sees turns,
     * colours and ids and nothing about nodes. Existing boards have no turn
     * field: known messages are resolved through their node, and an unloaded
     * reply's position is never guessed from its text or the DOM index.
     * @param entries - the board, newest first.
     * @param nodes - the conversation's node table, when it has one.
     * @returns `{ turn, color, id }`, oldest first.
     */
    function turnsOf(entries, nodes) {
      const claimed = new Map()
      const turnless = new Map()
      for (const entry of entries) {
        if (entry.source !== 'reply' || !entry.messageId) continue
        const pin = { color: entry.color, id: entry.id }
        if (Number.isSafeInteger(entry.turn) && entry.turn >= 0) {
          if (!claimed.has(entry.turn)) claimed.set(entry.turn, pin)
        } else {
          turnless.set(entry.messageId, pin)
        }
      }
      if (turnless.size && nodes) {
        for (const node of finalNodes(nodes)) {
          const data = node.data
          const messageId = data.finalNode.messageId
          if (!turnless.has(messageId)) continue
          if (!(Number.isSafeInteger(data.turn) && data.turn >= 0)) continue
          if (!claimed.has(data.turn)) claimed.set(data.turn, turnless.get(messageId))
        }
      }
      // The board prepends new pins; oldest first keeps the rules in reading order.
      return Array.from(claimed, ([turn, pin]) => ({ turn, color: pin.color, id: pin.id })).reverse()
    }

    /**
     * The stylesheet that colours this Session's pinned turns on the host rail.
     * Each rule styles the mark's existing tick, never its hit area, handlers or
     * virtual-list position; the colour and the length are the pin's own.
     * @param input - sessionId, entries, nodes, chatT and prefs of this render.
     * @returns the CSS rules; empty when no pinned turn can be spelled.
     */
    function railRules({ sessionId, entries, nodes, chatT, prefs }) {
      const dom = railDom(sessionId)
      /** The rail selectors that point at one turn's mark. */
      const targetsFor = turn => railTargets(dom, turn, chatT)
      // Multiple replies in a turn share a mark, so a turn is styled once.
      return turnsOf(entries, nodes).map(({ turn, color, id }) => {
        const targets = targetsFor(turn)
        // No usable spelling for this turn (rail not painted and no dictionary
        // yet): write nothing rather than an invalid empty :is().
        if (!targets.length) return ''
        const match = ':is(' + targets.join(',') + ')'
        return match + '::before{width:' + railWidth(prefs, id || color) + 'px;height:' + RAIL_PINNED_HEIGHT + 'px;border-radius:4px;transform:translateY(-50%);background:'
          + (prefs.uniformColor ? prefs.color : color) + ';opacity:1}'
          + match + '[aria-current="true"]::before{box-shadow:inset 0 0 0 1px var(--dsw-alias-label-primary,currentColor)}'
      }).filter(Boolean).join('\n')
    }

    /** Whether this row is a pinned reply the board still has to place on a turn. */
    function needsTurn(row) {
      return row.source === 'reply' && typeof row.messageId === 'string' && row.messageId !== ''
        && !(Number.isSafeInteger(row.turn) && row.turn >= 0)
    }

    // ---------------------- turn lookup: which message sits on which turn ---

    // Pins whose turn the history read could not place. Memory only, never
    // persisted: the card says why the right-hand marker is missing, and a reload
    // simply asks the history again.
    const unresolvedTurns = new Map()
    const unresolvedListeners = new Set()
    let unresolvedVersion = 0

    /** Replace one Session's unknown-turn set; an empty list clears it. */
    function markUnresolved(sessionId, ids) {
      const key = String(sessionId)
      const next = new Set(ids)
      const current = unresolvedTurns.get(key)
      if (current && current.size === next.size && Array.from(next).every((id) => current.has(id))) return
      if (next.size === 0) unresolvedTurns.delete(key)
      else unresolvedTurns.set(key, next)
      unresolvedVersion += 1
      for (const listener of Array.from(unresolvedListeners)) {
        try { listener() } catch (error) { /* keep the other readers */ }
      }
    }

    /** Whether this pin still has no turn after a history read came back empty. */
    function isTurnUnresolved(sessionId, messageId) {
      const set = unresolvedTurns.get(String(sessionId))
      return !!set && set.has(String(messageId))
    }

    /** Listen for a change in which pins a lookup has called unresolvable; @returns the unsubscribe. */
    function subscribeUnresolved(listener) {
      unresolvedListeners.add(listener)
      return () => { unresolvedListeners.delete(listener) }
    }

    const unresolvedSnapshot = () => unresolvedVersion

    /** Re-render the board when a lookup starts or stops explaining a pin. */
    function useUnresolvedVersion() {
      return React.useSyncExternalStore(subscribeUnresolved, unresolvedSnapshot, unresolvedSnapshot)
    }

    /**
     * Ask the history to place the pins that are still without a turn. The
     * header and the open column read the same board, so both ask with the same
     * id list and skip the same empty case; three moments ask for one walk — a
     * mount, a pin list that still holds an unresolved row, and a conversation
     * that has loaded more messages, which is what `nodeCount` watches.
     * @param sessionId - the Session whose pins are asked about.
     * @param entries - the board as stored.
     * @param recover - the shared per-Session lookup, when the plugin got one.
     * @param nodeCount - how many messages the conversation holds; a caller that
     *   reads the board alone passes nothing, and that constant leaves its
     *   dependency list as it was.
     * @returns nothing.
     */
    function useRecoverTurns(sessionId, entries, recover, nodeCount) {
      const pending = JSON.stringify(entries.filter(needsTurn).map((row) => row.messageId).sort())
      React.useEffect(() => {
        if (pending === '[]' || typeof recover !== 'function') return undefined
        recover(sessionId, JSON.parse(pending))
        return undefined
      }, [sessionId, pending, nodeCount, recover])
    }

    /** How many messages the conversation holds: every node its table lists. */
    function countNodes(nodes) {
      try { return nodes.values().length } catch (error) { return 0 }
    }

    /** Said once: a missing history service must not fill the console on every retry. */
    let historyQuiet = false

    /**
     * The history reader, resolved at call time. The plugin mounts on `slots`
     * alone, so `remote` and `sessions` may arrive late or never; asking again on
     * the next lookup is what lets a late arrival be picked up.
     * @returns the session history service, or undefined when it is not there.
     */
    function historyService(ctx) {
      const read = (name) => {
        try { return typeof ctx.get === 'function' ? ctx.get(name) : undefined } catch (error) { return undefined }
      }
      const remote = read('remote')
      const session = (remote && remote.session) || read('remote.session')
      return session && typeof session.events === 'function' ? session : undefined
    }

    /**
     * Where this Session's events live: the subagent child when the sessions
     * service names one, otherwise the Session itself. A missing sessions service
     * only costs the subagent hop, never the lookup.
     */
    function historyAddress(ctx, sessionId) {
      try {
        const sessions = typeof ctx.get === 'function' ? ctx.get('sessions') : undefined
        const child = sessions && typeof sessions.subagentAddress === 'function'
          ? sessions.subagentAddress(sessionId)
          : undefined
        if (child) return { kind: 'subagent', ...child }
      } catch (error) { /* a plain session address is always usable */ }
      return { kind: 'session', sessionId }
    }

    // Read passive pages at one fixed cut: do not move the transcript, load
    // older rows into the UI, or match by ambiguous reply text.
    async function recoverTurns(ctx, sessionId, ids, signal) {
      const remote = historyService(ctx)
      // No reader means no lookup, not a crash: the board has its own line about
      // a pin whose turn stayed unknown.
      if (remote === undefined) {
        if (!historyQuiet) {
          historyQuiet = true
          console.info('[reading-board] History lookup unavailable: the session history service is not mounted.')
        }
        return
      }
      const address = historyAddress(ctx, sessionId)
      const aborted = () => !!(signal && signal.aborted)
      const remaining = new Set(ids)
      const found = new Map()
      let throughSeq, beforeSeq
      try {
        while (remaining.size && !aborted()) {
          const request = { address, maxMessages: 30 }
          if (beforeSeq !== undefined) Object.assign(request, { beforeSeq, throughSeq })
          const reply = await remote.events(request, signal)
          if (!reply.ok || aborted()) break
          const page = reply.value
          if (throughSeq === undefined) throughSeq = page.cursor
          for (const {event} of page.records) {
            if (event?.type !== 'assistant/message') continue
            const turn = event.data?.turn, id = event.data?.message?.id
            if (Number.isSafeInteger(turn) && turn >= 0 && remaining.delete(id)) found.set(id, turn)
          }
          const first = page.records[0]?.event?.seq
          if (!page.hasMore || !Number.isSafeInteger(first) || first <= 0
            || (beforeSeq !== undefined && first >= beforeSeq)) break
          beforeSeq = first
        }
      } finally {
        if (!aborted() && found.size) board.backfill(sessionId, found)
      }
    }

    /**
     * The rail's rule set for one header render: this device's appearance
     * preferences applied to this Session's board and node table.
     * @param sessionId - the Session whose rail is styled.
     * @param entries - the board as stored.
     * @param nodes - the conversation's node table, when it has one.
     * @param chatT - the chat dictionary, for the label spellings.
     * @returns the CSS rules; empty when no pinned turn can be spelled.
     */
    function useRailRules(sessionId, entries, nodes, chatT) {
      const prefs = useRailPrefs()
      return railRules({ sessionId, entries, nodes, chatT, prefs })
    }

    /**
     * One catch-up frame for a rail whose painted DOM (and chat locale) were not
     * there on the first render: when there are turns to spell but no rule set
     * yet, ask for exactly one re-render, in which the rules read the live rail.
     * The state value only exists to make that re-render happen; the ref keeps a
     * second frame from being asked for.
     * @param rules - this render's rule set; '' means nothing could be spelled.
     * @param entries - the board as stored.
     * @returns nothing.
     */
    function useRailRebuild(rules, entries) {
      const [, setRailRebuild] = React.useState(0)
      const rebuilt = React.useRef(false)
      // Mount only: any later rule set comes from the next render anyway.
      React.useEffect(() => {
        if (rules !== '' || rebuilt.current) return undefined
        const wanted = entries.some((entry) => entry.source === 'reply'
          && Number.isSafeInteger(entry.turn) && entry.turn >= 0)
        if (!wanted) return undefined
        rebuilt.current = true
        let frame = 0
        try { frame = window.requestAnimationFrame(() => setRailRebuild((value) => value + 1)) } catch (error) { frame = 0 }
        return () => { if (frame) try { window.cancelAnimationFrame(frame) } catch (error) { /* already gone */ } }
      }, [])
    }

    /** The header entry keeps the rail in sync even with the board closed. */
    function HeaderEntry(props) {
      const entries = useEntries(props.sessionId)
      const nodes = props.useChat(snapshot => snapshot.nodes)
      // Three moments ask for one walk: this mount, a pin list that still holds
      // an unresolved row, and a conversation that has loaded more messages (a
      // pin outside the old window may be placeable now). The walk is shared per
      // Session, so these moments cannot start parallel paging.
      useRecoverTurns(props.sessionId, entries, props.recover, countNodes(nodes))
      const rules = useRailRules(props.sessionId, entries, nodes, props.chatT)
      useRailRebuild(rules, entries)
      return h(React.Fragment, null, rules ? h('style', null, rules) : null, h(IconAction, {
        label: props.t('header.open'),
        onClick: () => { props.openPanel() },
        variant: props.variant,
        note: null,
      }))
    }

    // ------------------------------------------------------------ the plugin ---

    return {
      name: 'dsh-pin-bookmarks',
      // Only the service the plugin cannot live without: every registration needs
      // `slots`. The history reader is resolved per lookup and the locale at apply
      // time, so an absent `remote`, `sessions` or locale degrades the rail and
      // the copy instead of taking the whole plugin — and the board — off screen.
      inject: ['slots'],
      apply(ctx) {
        /**
         * One history walk per Session at a time. The header, the column opening
         * and a growing conversation all ask for the same rows, so a running
         * walk absorbs the new ids instead of starting a second paging loop, and
         * a single controller covers that attempt.
         * @returns a promise that settles when this walk is over.
         */
        const lookups = new Map()
        const recover = (sessionId, ids) => {
          const key = String(sessionId)
          const running = lookups.get(key)
          if (running) {
            for (const id of ids) running.ids.add(id)
            return running.promise
          }
          const controller = new AbortController()
          const attempt = { controller, ids: new Set(ids), promise: null }
          lookups.set(key, attempt)
          attempt.promise = recoverTurns(ctx, key, attempt.ids, controller.signal)
            // Whether the walk ran to its end: only a completed walk may call a
            // pin unresolvable. A failed one leaves every pin unmarked, so a
            // later attempt can still place it.
            .then(() => true, (error) => {
              console.warn('[reading-board] History lookup failed; will retry on the next visit.', error instanceof Error ? error.message : 'unknown error')
              return false
            })
            .then((completed) => {
              if (!completed || lookups.get(key) !== attempt) return
              // Whatever is still turn-less after the walk stays marked, so its
              // card explains the missing marker rather than staying silent.
              const still = Array.from(attempt.ids).filter((id) => {
                const row = board.entries(key).find((entry) => entry.messageId === id)
                return row === undefined || needsTurn(row)
              })
              markUnresolved(key, still)
            })
            .finally(() => {
              if (lookups.get(key) === attempt) lookups.delete(key)
            })
          return attempt.promise
        }
        // A teardown abandons any walk still paging: nobody wants those pages now.
        if (typeof ctx.effect === 'function') {
          ctx.effect(() => () => {
            for (const attempt of Array.from(lookups.values())) attempt.controller.abort()
            lookups.clear()
          }, 'reading-board: history lookups')
        }

        let railTranslate = key => key
        let translate = (key) => DICT.zh[key] || key

        // The locale is resolved here rather than declared, so a missing locale
        // service cannot stop the plugin mounting. Anything unusable leaves the
        // built-in dictionary and the pass-through railTranslate in place, and the
        // rail's DOM-template path carries its own labels regardless.
        try {
          const locale = (() => {
            try {
              const resolved = typeof ctx.get === 'function' ? ctx.get('locale') : undefined
              return resolved || ctx.locale
            } catch (error) { return undefined }
          })()
          if (locale && typeof locale.register === 'function' && typeof locale.bind === 'function') {
            // Scoped so a re-applied plugin gives its namespace back, and never
            // fatal: a duplicate registration just leaves the built-in copy in use.
            const register = () => {
              try { return locale.register(NS, { zh: DICT.zh, en: DICT.en }) } catch (error) { return () => {} }
            }
            if (typeof ctx.effect === 'function') ctx.effect(register, 'reading-board: dictionaries')
            else register()
            railTranslate = locale.bind('chat')
            const bound = locale.bind(NS)
            translate = (key) => {
              try {
                const value = bound(key)
                // A miss comes back as the key itself, so the key is not copy.
                if (typeof value === 'string' && value !== '' && value !== key) return value
              } catch (error) { /* fall through to the built-in copy */ }
              return DICT.zh[key] || key
            }
          }
        } catch (error) {
          console.warn('[reading-board] Locale unavailable; using built-in copy.', error instanceof Error ? error.message : 'unknown error')
        }

        const t = (key) => translate(key)

        /** Reveal the board's tab in the right column; @returns whether it opened. */
        const openPanel = () => {
          let right
          try {
            right = ctx.get('sidebarRight')
          } catch (error) {
            return false
          }
          if (!right || typeof right.openTab !== 'function') return false
          try {
            right.openTab(KIND)
            return true
          } catch (error) {
            return false
          }
        }

        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'ask-reader-settings', order: 65,
          label: () => t('tab.title'), inject: () => ({ t }),
        }, RailSettings))

        ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: TAB_ID,
          // Opening the column is the second moment that may resolve a pin's
          // turn, so the panel can ask for the same shared lookup.
          inject: () => ({ t, recover }),
        }, ReaderPanel))

        ctx.inject(['sidebarRightTabs'], (scope) => {
          const tabs = scope.get('sidebarRightTabs')
          if (!tabs || typeof tabs.register !== 'function') return
          tabs.register({
            id: TAB_ID,
            kind: KIND,
            priority: 'extension',
            keepMounted: true,
            title: () => t('tab.title'),
            guide: [{
              id: 'reader',
              order: 30,
              title: () => t('guide.title'),
              description: () => t('guide.description'),
              icon: BookmarkGlyph,
            }],
          })
        })

        ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
          name: 'conversation.chat.assistant-actions',
          id: 'ask-reader-save',
          order: 30,
          label: () => t('save.action'),
          inject: (sessionId) => ({ t, sessionId, openPanel, variant: 'arrow' }),
        }, SaveAction))

        ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
          name: 'conversation.chat.assistant-actions', id: 'ask-reader-quiet', order: 31,
          label: () => t('save.quiet'),
          inject: (sessionId) => ({ t, sessionId, variant: 'star' }),
        }, SaveAction))

        ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
          name: 'conversation.session.header.utilities',
          id: 'ask-reader-open',
          order: 25,
          label: () => t('header.open'),
          inject: (sessionId) => ({
            t, sessionId, openPanel, recover, variant: 'bookmark',
            chatT: (key, params) => railTranslate(key, params),
          }),
        }, HeaderEntry))
      },
    }
  },
})