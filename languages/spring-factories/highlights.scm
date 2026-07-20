; Adapted from tree-sitter-properties' own queries/highlights.scm (MIT).
; `spring.factories` keys are fully qualified type names and the values are
; comma-separated implementation lists, so the key/value split is all the
; structure there is to highlight.
(comment) @comment

(key) @property

(value) @string

(value (escape) @string.escape)

(property [ "=" ":" ] @operator)

[ "${" "}" ] @punctuation.special

[ "." "\\" ] @punctuation.delimiter
