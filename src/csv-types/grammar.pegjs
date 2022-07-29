// Simple Arithmetics Grammar
// ==========================
//
// Parses CSV types on a column based system
// 
// eg. `Date|int;string;empty|int;bool;float;'open'|'close'`

csvTypes
  = head:Expr tail:(";" Expr)* {
    return [head, ...tail.map((v) => v[1])];
  };

Expr
  = head:Type tail:("|" Type)*  {
    if (tail.length > 0) {
      return {
        type: 'union',
        values: [head, ...tail.map((v) => v[1])],
      };  
    }
    return head;
  };
  
Type
  = Primitive / Constant;

Constant
  = "'" s:String "'" { return { type: 'constant', value: s }; };
  
String
  = [^']+ { return text(); };
  
Primitive
  = p:("Date"/"string"/"int"/"float"/"empty"/"bool") {
    return { type: p };
  };