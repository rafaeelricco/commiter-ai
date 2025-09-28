export {
  type FromJSON,
  type Infer,
  type Parser,
  type ParserDef,
  type ParseResult,
  parse,
  object,
  objectMap,
  pair,
  array,
  string,
  number,
  boolean,
  any,
  json,
  nullP,
  stringNumber,
  undefinedP,
  oneOf,
  maybe,
  nullable,
  stringLiteral,
  triple,
  always,
  fail,
  optional
};

import { Result, Success, Failure, traverse } from "@/lib/result";
import { Maybe, Just, Nothing, Nullable } from "@/lib/maybe";
import { List } from "@/lib/list";
import { Json } from "@/lib/json/types";

type Infer<A extends Parser<unknown>> = A extends Parser<infer B> ? B : never;

interface FromJSON<T> {
  parser(): Parser<T>;
}

class Parser<T> {
  readonly run: (input: unknown) => ParseResult<T>;

  constructor(run: (input: unknown) => ParseResult<T>) {
    this.run = run;
  }

  then<W>(f: (v: T) => ParseResult<W>): Parser<W> {
    return new Parser((v) => this.run(v).then(f));
  }

  map<W>(f: (v: T) => W): Parser<W> {
    return new Parser((v) => this.run(v).map<W>(f));
  }
}

function parse<T>(input: unknown, parser: Parser<T>): Result<string, T> {
  return parser.run(input).mapFailure(showPath);
}

function showPath([path, error]: [Path, string]): string {
  return error + ". When parsing: " + Array.from(path).join(".");
}

type ParseResult<T> = Result<[Path, string], T>;

type Path = List<string>;

const fail = <T>(msg: string): ParseResult<T> => Failure([List.empty(), msg]);

const always = <T>(v: T): Parser<T> => new Parser((_) => Success(v));

const any: Parser<unknown> = new Parser((v) => Success(v));

const string: Parser<string> = new Parser((v) => (typeof v === "string" ? Success(v) : fail("expected string but found " + typeof v)));

const number: Parser<number> = new Parser((v) => (typeof v === "number" ? Success(v) : fail("expected number but found " + typeof v)));

const stringNumber: Parser<number> = string.then((s) => {
  const v = parseInt(s, 10);
  return isNaN(v) ? fail("not a valid number: " + s) : Success(v);
});

const boolean: Parser<boolean> = new Parser((v) => (typeof v === "boolean" ? Success(v) : fail("expected boolean but found " + typeof v)));

const array = <V>(parseValue: Parser<V>): Parser<Array<V>> =>
  new Parser((input) => {
    if (!Array.isArray(input)) {
      return fail("expected array but found " + typeof input);
    }

    return traverse(List.from(input), parseValue.run).map((list) => Array.from(list));
  });

type ParserDef<A> = {
  [P in keyof A]: Parser<A[P]>;
};

const object = <A>(parsers: ParserDef<A>): Parser<A> =>
  new Parser((input) => {
    if (typeof input !== "object" || input === null) {
      return fail("expected object but found " + typeof input);
    }
    const obj = input as { [P in keyof A]: unknown };

    const result = {} as A;
    for (const field in parsers) {
      const parser = parsers[field];
      const parsed = parser.run(obj[field]);
      switch (true) {
        case parsed instanceof Success:
          result[field] = parsed.value;
          break;
        case parsed instanceof Failure: {
          const [path, msg] = parsed.error;
          return Failure([List.cons(field, path), msg]);
        }
        default:
          return parsed satisfies never;
      }
    }

    return Success(result);
  });

type ObjectMap<A> = { [x: string]: A };

const objectMap = <A>(parser: Parser<A>): Parser<ObjectMap<A>> =>
  new Parser((input) => {
    if (typeof input !== "object" || input === null) {
      return fail("expected object but found " + typeof input);
    }

    const obj = input as Record<string, unknown>;
    const result = {} as ObjectMap<A>;
    for (const field in obj) {
      const parsed = parser.run(obj[field]);
      switch (true) {
        case parsed instanceof Success:
          result[field] = parsed.value;
          break;
        case parsed instanceof Failure: {
          const [path, msg] = parsed.error;
          return Failure([List.cons(field, path), msg]);
        }
        default:
          return parsed satisfies never;
      }
    }

    return Success(result);
  });

const pair = <L, R>(lparse: Parser<L>, rparse: Parser<R>): Parser<[L, R]> =>
  new Parser((input) => {
    if (!Array.isArray(input)) {
      return fail("expected array but found " + typeof input);
    }
    if (input.length !== 2) {
      return fail("expected array with 2 elements but it found " + input.length);
    }
    const [l, r] = input;

    return lparse.run(l).then((left) => rparse.run(r).then((right) => Success([left, right])));
  });

const triple = <A, B, C>(pA: Parser<A>, pB: Parser<B>, pC: Parser<C>): Parser<[A, B, C]> =>
  new Parser((input) => {
    if (!Array.isArray(input)) {
      return fail("expected array but found " + typeof input);
    }
    if (input.length !== 3) {
      return fail("expected array with 3 elements but it found " + input.length);
    }
    const [ia, ib, ic] = input;

    return pA.run(ia).then((a) => pB.run(ib).then((b) => pC.run(ic).then((c) => Success([a, b, c]))));
  });

const oneOf = <V>(parsers: Array<Parser<V>>): Parser<V> =>
  new Parser((input) => {
    let parsed: ParseResult<V> = fail("no parsers");

    const errors: Array<[Path, string]> = [];

    for (const parser of parsers) {
      parsed = parser.run(input);
      if (parsed instanceof Success) {
        return parsed;
      }
      errors.push(parsed.error);
    }

    const failure = Failure<[Path, string], V>([List.empty(), errors.map(showPath).join("\n")]);
    return failure;
  });

const maybe = <V>(parser: Parser<V>): Parser<Maybe<V>> => oneOf([nullP.map((_) => Nothing()), parser.map(Just<V>)]);

const nullable = <V>(parser: Parser<V>): Parser<Nullable<V>> => oneOf([nullP, parser]);

const nullP: Parser<null> = new Parser((v) => (v === null ? Success(null) : fail("expected null but found " + typeof v)));

const undefinedP: Parser<undefined> = new Parser((v) => (v === undefined ? Success(undefined) : fail("expected `undefined` " + typeof v)));

const stringLiteral = <T extends string>(str: T): Parser<T> => new Parser((v) => (v === str ? Success(v as T) : fail(`expected '${str}' but found '${v}'`)));

const optional = <V>(parser: Parser<V>): Parser<Maybe<V>> => oneOf([parser.map(Just<V>), undefinedP.map((_) => Nothing())]);

function rec<A>(f: (p: Parser<A>) => Parser<A>): Parser<A> {
  let lazyParser: Parser<A> | null = null;

  const recursiveParser = new Parser<A>((input: unknown) => {
    if (lazyParser === null) {
      lazyParser = f(recursiveParser);
    }
    return lazyParser.run(input);
  });

  return recursiveParser;
}

const json: Parser<Json> = rec((json) => oneOf<Json>([nullP, string, number, boolean, array(json), objectMap(json)]));
