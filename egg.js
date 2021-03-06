$(document).ready(function() {
  $("#btn-run").click(function() {
    websiteRun($("#program").val());
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
    expr = {
      type: "value",
      value: match[1]
    };
  else if (match = /^\d+\b/.exec(program))
    expr = {
      type: "value",
      value: Number(match[0])
    };
  else if (match = /^[^\s(),"]+/.exec(program))
    expr = {
      type: "word",
      name: match[0]
    };
  else
    throw new SyntaxError("Unexpected syntax: " + program);
  /* jshint +W084 */

  return parseApply(expr, program.slice(match[0].length));
}

/* Parse the application. E.g. +(1, 2) */
function parseApply(expr, program) {
  program = skipSpace(program);
  if (program[0] != "(")
    return {
      expr: expr,
      rest: program
    };

  program = skipSpace(program.slice(1));
  expr = {
    type: "apply",
    operator: expr,
    args: []
  };
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

/* Remove space and comments */
function skipSpace(string) {
  var regex = /(\s+|#.*?\n)/;
  match = regex.exec(string);

  while (match !== null && match.index === 0) {
    string = string.slice(match[0].length);
    match = regex.exec(string);
  }

  return string;
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
  switch (expr.type) {
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

/* Assigns a value to an existing variable. Updates the variable in the outer scope if it doesn't exist in the inner scope. If the variable is not defined at all, throws a ReferenceError. */
specialForms["set"] = function(args, env) {
  if (args.length != 2 || args[0].type != "word")
    throw new SyntaxError("Bad use of set");
  var value = evaluate(args[1], env);

  while (env !== null && !(Object.prototype.hasOwnProperty.call(env, args[0].name))) {
    env = Object.getPrototypeOf(env);
  }

  // Check whether the variable was found
  if (env === null) {
    throw new ReferenceError("set: Cannot find variable " + args[0].name);
  }

  // The variable was found. Set the value in the found scope and return value.
  env[args[0].name] = value;
  return value;
};

/* Get input from user. Takes an optional arguments of a prompt question and default text. */
specialForms["input"] = function(args, env) {
  var promptText = "Enter input";
  var defaultText = "";
  if (args.length >= 1) {
    promptText = args[0].value;
  }
  if (args.length >= 2) {
    defaultText = args[1].value;
  }
  return prompt(promptText, defaultText);
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
  if (!args.length) {
    throw new SyntaxError("Array.length: No array given");
  }
  if (args.length > 1) {
    throw new SyntaxError("Array.length: Too many arguments given. Expected" +
      "1 got " + args.length);
  }
  var array = evaluate(args[0], env);
  return array.length;
};

/* Get an element from an array */
specialForms.element = function(args, env) {
  console.log("array.element");
  console.log(args);
  if (args.length > 2 || args.length <= 0) {
    throw new SyntaxError("Array.element:  Incorrect number of arguments " +
      "given. Expected 2 got " + args.length);
  }
  var index = evaluate(args[1], env);
  var indexType = typeof index;
  if (indexType !== "number") {
    throw new TypeError("Array.element: Expected \"number\", got \"" +
      indexType + "\"");
  }
  var array = evaluate(args[0], env);
  console.log(array);
  if (index < 0 || index > array.length) {
    throw new Error("Array.element: index " + index + " out of bounds.");
  }
  return (array[index]);
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
  $("#output").val($("#output").val() + value + "\n");
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
  } catch (error) {
    console.log(error);
    $("#output").val(error);
    hasError(true);
    return error.toString();
  }
}

/* Convenience function to put program output onto web page. */
function websiteRun(program) {
  $("#output").val("");
  run(program);
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
