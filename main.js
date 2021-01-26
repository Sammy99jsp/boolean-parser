// List of Supported Operations
const OPERATIONS = Object.freeze({
  AND: Symbol.for("OPERATIONS.AND"),
  OR: Symbol.for("OPERATIONS.OR"),
  XOR: Symbol.for("OPERATIONS.XOR"),
  NOT: Symbol.for("OPERATIONS.NOT")
});

// List of supported logical symbols
const SUPPORTED_LOGICAL_CHARS = Object.freeze({
  "AND": OPERATIONS.AND,
  "&": OPERATIONS.AND,
  "&&": OPERATIONS.AND,
  ".": OPERATIONS.AND,
  "∧": OPERATIONS.AND,
  "OR": OPERATIONS.OR,
  "||": OPERATIONS.OR,
  "∨": OPERATIONS.OR,
  "+": OPERATIONS.OR,
  "XOR": OPERATIONS.XOR,
  "⊻": OPERATIONS.XOR,
  "⊕": OPERATIONS.XOR,
  "NOT": OPERATIONS.NOT,
  "!": OPERATIONS.NOT,
  "¬": OPERATIONS.NOT,
});

/* Extending the prototype of Array (don't do this at home, kids) to add recursion functionality.
Equivalent to arr[path[0]][path[1]][. . . ] or arr[path[0], path[1], . . .] */
// Allow JS to retrieve a path from a multidimensional array;
Array.prototype.fromPath = function(path) {
    return path.reduce((a, b) => a[b], this);
}

// Allow JS to set a particular path in a multidimensional array
Array.prototype.setPath = function(path, val, arr=null) {
    let c = path.shift();
    if(!arr) {
        arr = this;
    }
    if(path.length === 0) {
        arr[c] = val;
        return arr;
    } else {
        arr[c] = this.setPath(path, val, arr[c]);
        return arr;
    }
}

Array.prototype.finalIncrement = function() {
  return [...(this.slice(0, -1)), this[this.length -1] + 1];
}

function isBooleanExpObject(obj) {
  if(obj instanceof Object) {
    return Object.values(OPERATIONS).indexOf(Reflect.ownKeys(obj)[0]) > -1;
  }
  return false;
}

// PARSER
function removeSpaces(arr) {
  let toAdd = 0;
  let out = [];
  for (let i = 0; i< arr.length; i++) {
    if( arr[i] instanceof Array) {
      out[toAdd] = (removeSpaces(arr[i]));
      toAdd++;
      continue;
    }
    if(arr[i] == " ") {
      toAdd++;
      continue;
    }
    if(!out[toAdd]) {
      out[toAdd] = arr[i];
      if(arr[i + 1] instanceof Array) {
        toAdd++;
      }
    } else {
      out[toAdd] += arr[i];
    }
  }
  return out.filter(e => e);
}
function parserStep2(arr) {
  let operation;
  let var1;
  if(typeof arr === "string") {
    return arr;
  }
  if(isBooleanExpObject(arr)) {
    return arr;
  }
  if(arr.length > 3) {
    // More than three in a row :(

    let tmpArr = [...arr];
    // Check for NOTs

    // NOTs without spaces, but with brackets ¬(...) || !(...)
    let nots0 = tmpArr.reduce((a, b, i) => {
      if(typeof b === "string") {
        if((b==="!"||b==="¬") && tmpArr[i+1] instanceof Array) {
          return [...a, i];
        }
      }
      return a;
    }, []).map(e=> {
      tmpArr.splice(e, 1);
      return {index: e, space: true};
    });
    // NOTs without spaces ¬A || !A
    let nots1 = tmpArr.reduce((a, b, i) => {
      if(typeof b === "string")
        return b.match(/(?=¬|!)/) ? [...a, i] : a;
      return a;
    }, []).map(e => ({index: e, space: false}));
    // NOTs with spaces
    let nots2 = tmpArr.reduce((a, b, i) => {
      if(typeof b === "string")
        return b === "NOT" ? [...a, i] : a;
      return a;
    }, []).map(e => ({index: e, space: true}));

    let nots = [...nots0, ...nots1, ...nots2].sort((a, b) => a.index - b.index);

    nots.forEach(e => {
      let tmp = tmpArr.splice(e.index, e.space ? 2: 1);

      tmpArr.splice(e.index, 0, {[OPERATIONS.NOT] : parserStep2(tmp[tmp.length -1])})
    })

    /// Look for ANDs, ORs, XORs in index 1
    let debug = 0;
    while (SUPPORTED_LOGICAL_CHARS[tmpArr[1]]) {
      console.log(tmpArr)
      debug++;
      if(debug > 50 ) {
        break;
      }
      let opArr = tmpArr.splice(0,3);
      let op = SUPPORTED_LOGICAL_CHARS[opArr[1]];
      let operands = [opArr[0], opArr[2]];
      let out = operands.map(e => parserStep2(e));
      tmpArr.splice(0, 0, {[op]: out});
    }

    return tmpArr[0];

  }
  if(arr.length === 3) {
    // Operation with two vars
    operation = SUPPORTED_LOGICAL_CHARS[arr[1].toUpperCase()];
    var1 = arr[0];
    let var2 = arr[2];

    // If there is nesting
    if(var1 instanceof Array) {
      var1 = parserStep2([...var1]);
    }

    if(var2 instanceof Array) {
      var2 = parserStep2([...var2]);
    }

    return {[operation]: [var1, var2]};

  } else if(arr.length === 2) {
    operation = SUPPORTED_LOGICAL_CHARS[arr[0].toUpperCase()];
    var1 = arr[1];

    // Check for nesting
    if(var1 instanceof Array) {
      var1 = parserStep2(var1);
    }

    return {[operation]: var1};
  } else if(arr.length === 1) {
    // Mainly for people who like doing "¬A" instead of "NOT A"
    let curr = arr[0];
    if(curr[0] === "¬" || curr[0] === "!") {
      operation = SUPPORTED_LOGICAL_CHARS["¬"];
      var1 = arr[0].substring(1);
      return {[operation]: var1};
    }
  }
}
function booleanParser(str) {
  // Look through the string for ( ) pairs, and nest an array.
  let out = [];
  let path = [0];
  for (let i=0; i<str.length; i++) {
    let char = str[i];
    if(char === "(") {
      out.setPath([...path], []);
      path.push(0);
      continue;
    } else if(char === ")") {
      path.pop();
      path = path.finalIncrement();
      continue;
    } else {
      out.setPath([...path], char);
      path = path.finalIncrement();
    }
  }
  return parserStep2(removeSpaces(out));
}

let STOP_DEBUG = 0;
// INTERPRETER

Array.prototype.flatRecursive = function() {
  arr = [...this];
  while(arr.some(e => e instanceof Array)) {
    arr = arr.flat();
  }
  return arr;
}

function _findVariables(bool, arr=[]) {
  if(bool instanceof Array) {
    return [...arr, ...(bool.map(e => _findVariables(e)))];
  }
  if(bool instanceof Object) {
    let key = Reflect.ownKeys(bool)[0];
    return _findVariables(bool[key], arr);
  }

  if(typeof bool === "string") {
    return bool;
  }
}

function findVariables(bool) {
  return _findVariables(bool).flatRecursive();
}

function setVars(bool, input) {
  if(bool instanceof Array) {
    return (bool.map(e => setVars(e, input)));
  }
  if(bool instanceof Object) {
    let key = Reflect.ownKeys(bool)[0];
    return {[key]: setVars(bool[key], input)};
  }

  if(typeof bool === "string") {
    return input[bool];
  }
}

/**
  @param {Object(OPERATIONS => (Array(Boolean | this) | Boolean))} bool
*/
function _evaluateBooleanExp(bool) {
  if(typeof bool === "boolean") {
    return bool;
  }

  if(bool instanceof Array) {
    return bool.map(e => _evaluateBooleanExp(e));
  }

  let key = Reflect.ownKeys(bool)[0];
  let operands = bool[key];

  operands = _evaluateBooleanExp(operands);

  switch(key) {
    case OPERATIONS.NOT:
      return !operands;
    case OPERATIONS.AND:
      return operands[0] && operands[1];
    case OPERATIONS.OR:
      return operands[0] || operands[1];
    case OPERATIONS.XOR:
      return (operands[0] && !operands[1]) || (!operands[0] && operands[1]);
  }
}

/**
  @param {Object ~ BooleanExpression} bool
  @param {Object(name => boolean) input
  @returns {Object(name => boolean)}
*/
function evaluateBoolExp(bool, input) {
  // Check if all variables in the expression are defined.
  if(!findVariables(bool).every(e => Object.keys(input).indexOf(e) > -1)) {
    throw new Error("InvalidInputError");
  }

  return _evaluateBooleanExp(setVars(bool, input));

  // Replace the variable with its value.

}

class BooleanExpression {
  constructor(obj) {
    this._ = obj;
  }

  execute(inputs) {
    return evaluateBoolExp(this._, inputs);
  }
}

BooleanExpression.parse = function(plaintext) {
  return new BooleanExpression(booleanParser(plaintext));
}
