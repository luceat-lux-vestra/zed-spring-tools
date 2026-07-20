; Adapted from tree-sitter-properties' own queries/highlights.scm (MIT).
; Tree-sitter only sees key/value pairs here; the JPQL inside each value is
; highlighted by Spring's embedded semantic tokens, not by this grammar.
(comment) @comment

(key) @property

(value) @string

(value (escape) @string.escape)

(property [ "=" ":" ] @operator)

[ "${" "}" ] @punctuation.special

[ "." "\\" ] @punctuation.delimiter
