/* Parse Expression
 * Type "value" is a string or number
 * Type "word" is an identifier
 * Type "apply" is an application (of an operator)
 */
function parseExpression(program) {
  program = skipSpace(program);
  var match, expr;
  /* Disable JSHint warning about assignment in conditional expression */
  /* jshint -W084 */
  if (match = /^"([^"]*)"/.exec(program))
    expr = {type: "value", value: match[1]};
  else if (match = /^\d+\b/.exec(program))
    expr = {type: "value", value: Number(match[0])};
  else if (match = /^[^\s(),"]+/.exec(program))
    expr = {type: "word", name: match[0]};
  else
    throw new SyntaxError("Unexpected syntax: " + program);
  /* jshint +W084 */

  return parseApply(expr, program.slice(match[0].length));
}

/* Remove leading space */
function skipSpace(string) {
  var first = string.search(/\S/);
  if (first == -1) return "";
  return string.slice(first);
}
