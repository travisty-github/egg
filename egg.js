$(document).ready(function() {
  $("#btn-run").click(function() {
    websiteRun($("#program").val());
  });
  /* If real time checking, run the program after each keyup but do not show
     a response */
  $("#chkbox-real-time").click(function() {
    if($(this).prop("checked")) {
      run($("#program").val());
      $("#program").keyup(function() {
        run($("#program").val());
      });
    } else {
      $("#program").off("keyup");
      $("#program-form-group").removeClass("has-success");
      $("#program-form-group").removeClass("has-error");
    }
  });
});
/* Parse Expression
 * Type "value" is a string or number
 * Type "word" is an identifier
 * Type "apply" is an application
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

/* Parse the application. E.g. +(1, 2) */
function parseApply(expr, program) {
  program = skipSpace(program);
  if (program[0] != "(")
    return {expr: expr, rest: program};

  program = skipSpace(program.slice(1));
  expr = {type: "apply", operator: expr, args: []};
  while (program[0] != ")") {
    var arg = parseExpression(program);
    expr.args.push(arg.expr);
    program = skipSpace(arg.rest);
    if (program[0] == ",")
      program = skipSpace(program.slice(1));
    else if (program[0] != ")")
      throw new SyntaxError("Expected ',' or ')'");
  }
  return parseApply(expr, program.slice(1));
}

/* Remove leading space */
function skipSpace(string) {
  var first = string.search(/\S/);
  if (first == -1) return "";
  return string.slice(first);
}

/* Parses the program and returns an object containing expressions
   and statements */
function parse(program) {
  var result = parseExpression(program);
  if (skipSpace(result.rest).length > 0)
    throw new SyntaxError("Unexpected text after program");
  return result.expr;
}

/* Evaluate an expression */
function evaluate(expr, env) {
  switch(expr.type) {
    case "value":
      return expr.value;

    case "word":
      if (expr.name in env)
        return env[expr.name];
      else
      /* jshint -W086 */
        throw new ReferenceError("Undefined variable: " +
                                 expr.name);
    case "apply":
      /* jshint +W086 */
      if (expr.operator.type === "word" &&
          expr.operator.name in specialForms)
        return specialForms[expr.operator.name](expr.args,
                                                env);
      var op = evaluate(expr.operator, env);
      if (typeof op != "function")
        throw new TypeError("Applying a non-function.");
      return op.apply(null, expr.args.map(function(arg) {
        return evaluate(arg, env);
      }));
  }
}

var specialForms = Object.create(null);

/* A "if" statement */
specialForms["if"] = function(args, env) {
  if (args.length != 3)
    throw new SyntaxError("Bad number of args to if");

  if (evaluate(args[0], env) !== false)
    return evaluate(args[1], env);
  else
    return evaluate(args[2], env);
};

/* A "while" loop */
specialForms["while"] = function(args, env) {
  if (args.length != 2)
    throw new SyntaxError("Bad number of args to while");

  while (evaluate(args[0], env) !== false)
    evaluate(args[1], env);

  /* Since undefined does not exist in Egg, we return false,
     for lack of a meaningful result. */
  return false;
};

/* A "do" loop */
specialForms["do"] = function(args, env) {
  var value = false;
  args.forEach(function(arg) {
    value = evaluate(arg, env);
  });
  return value;
};

/* Defines a variable and assigns new values. */
/* jshint -W069 */
specialForms["define"] = function(args, env) {
  if (args.length != 2 || args[0].type != "word")
    throw new SyntaxError("Bad use of define");
  var value = evaluate(args[1], env);
  env[args[0].name] = value;
  return value;
};
/* jshint +W069 */

/* A function */
specialForms.fun = function(args, env) {
  if (!args.length)
    throw new SyntaxError("Functions need a body");
  function name(expr) {
    if (expr.type != "word")
      throw new SyntaxError("Arg names must be words");
    return expr.name;
  }
  var argNames = args.slice(0, args.length - 1).map(name);
  var body = args[args.length - 1];

  return function() {
    if (arguments.length != argNames.length)
      throw new TypeError("Wrong number of arguments. Expected " +
        argNames.length + " got " + arguments.length);
    var localEnv = Object.create(env);
    for (var i = 0; i < arguments.length; i++)
      localEnv[argNames[i]] = arguments[i];
    return evaluate(body, localEnv);
  };
};

/* Array type. */
specialForms.array = function(args, env) {
  if (!args.length) {
    throw new SyntaxError("No elements given for array.");
  }
  var array = [];
  args.forEach(function(e) {
    array.push(evaluate(e, env));
  });
  return array;
};
/* Return array length */
specialForms.length = function(args, env) {
  console.log(args);
  if (!args.length) {
    throw new SyntaxError("Array.length: No array given");
  }
  if (args.length > 1) {
    throw new SyntaxError("Array.length: Too many arguments given. Expected" +
    "1 got " + args.length);
  }
  if(args[0].operator.name!== "array") {
    throw new TypeError("Array.length: Expected array, got " + args[0].operator.name);
  }
  return args[0].args.length;
};

/* Get an element from an array */
specialForms.element = function(args, env) {
  if (!args.length) {
    throw new SyntaxError("Array.element: No array given");
  }
  if (args.length > 2) {
    throw new SyntaxError("Array.element: Too many arguments given. Expected" +
    "2 got " + args.length);
  }
  if(args[0].operator.name!== "array") {
    throw new TypeError("Array.element: Expected array, got " + args[0].operator.name);
  }
  var indexType = evaluate(args[1], env);
  if(typeof indexType !== "number") {
    throw new TypeError("Array.element: Expected number, got " + args[0].operator.name);
  }
  return(args[0].args[1].value);
};

/* Global environment with basic functions. */
var topEnv = Object.create(null);
topEnv["true"] = true;
topEnv["false"] = false;
/* jshint -W054 */
["+", "-", "*", "/", "==", "<", ">"].forEach(function(op) {
  topEnv[op] = new Function("a, b", "return a " + op + " b;");
/* jshint +W054 */
});
topEnv.print = function(value) {
  console.log(value);
  return value;
};

/* Convenience function to run programs */
function run() {
  try {
    var env = Object.create(topEnv);
    var program = Array.prototype.slice
    .call(arguments, 0).join("\n");
    hasError(false);
    return evaluate(parse(program), env);
  } catch(error) {
    hasError(true);
    return error.toString();
  }
}

/* Convenience function to put program output onto web page. */
function websiteRun(program) {
  $("#output").val(run(program));
}

/* Track whether the program has an error. */
function hasError(error) {
  if (error) {
    $("#program-form-group").removeClass("has-success");
    $("#program-form-group").addClass("has-error");
  } else {
    $("#program-form-group").removeClass("has-error");
    $("#program-form-group").addClass("has-success");
  }
}
