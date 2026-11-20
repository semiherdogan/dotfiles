# Maps a 9router /models response to an OpenCode `models` object.
# Fails on a response without a `data` array so the caller can skip 9router.
def obj_or_empty: if type == "object" then . else {} end;

if (type == "object") and ((.data | type) == "array") then
  [
    .data[]
    | select(type == "object")
    | (.capabilities | obj_or_empty) as $caps
    | select((.id | type) == "string" and (.id | length) > 0)
    # An explicit false means the model cannot call tools, which OpenCode needs.
    | select($caps.tools != false)
    | ($caps.contextWindow // .context_length) as $context
    | ($caps.maxOutput // .max_completion_tokens) as $output
    | select(($context | type) == "number" and ($output | type) == "number")
    | ($caps.reasoning == true) as $reasoning
    | (if $reasoning and ((.thinking_levels | type) == "array")
       then [.thinking_levels[] | select(type == "string" and length > 0)]
       else [] end) as $levels
    | {
        key: .id,
        value: (
          {
            name: .id,
            capabilities: {
              tools: true,
              input: (if $caps.vision == true then ["text", "image"] else ["text"] end),
              output: ["text"],
              reasoning: (if $reasoning then {supported: true} else {supported: false} end)
            },
            limit: {context: $context, output: $output}
          }
          # Levels pass through unchanged: 9router translates them per upstream.
          + (if ($levels | length) > 0
             then {variants: [$levels[] | {id: ., settings: {reasoningEffort: .}}]}
             else {} end)
        )
      }
  ]
  | from_entries
else
  error("9router /models response has no data array")
end
