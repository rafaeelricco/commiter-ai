export {
  Schema,
  type Infer,
  type SchemaDef,
  object,
  objectMap,
  pair,
  triple,
  map,
  boolean,
  number,
  string,
  array,
  json,
  maybe,
  nullable,
  optional,
  stringLiteral,
  oneOf,
  from,
  parse,
  serialize,
  parser,
  serializer
};

import * as P from "@/lib/json/parser";
import * as S from "@/lib/json/serializer";

import { Result } from "@/lib/result";
import { Parser, ParserDef } from "@/lib/json/parser";
import { Serializer, SerializerDef } from "@/lib/json/serializer";
import { Json } from "@/lib/json/types";
import { List } from "@/lib/list";
import { Maybe, Nullable } from "@/lib/maybe";

type Infer<A extends Schema<any>> = A extends Schema<infer B> ? B : never;

class Schema<A> {
  parser: Parser<A>;

  serializer: Serializer<A>;

  constructor(parser: Parser<A>, serializer: Serializer<A>) {
    this.parser = parser;
    this.serializer = serializer;
  }

  dimap<W>(p: (v: A) => W, s: (v: W) => A): Schema<W> {
    return new Schema(this.parser.map(p), this.serializer.rmap(s));
  }

  then<W>(p: (v: A) => Result<string, W>, s: (v: W) => A): Schema<W> {
    return new Schema(
      this.parser.then((v) => p(v).mapFailure((e) => [List.empty(), e])),
      this.serializer.rmap(s)
    );
  }
}

function parse<A>(schema: Schema<A>, input: unknown): Result<string, A> {
  return P.parse(input, schema.parser);
}

function serialize<A>(schema: Schema<A>, input: A): Json {
  return schema.serializer.run(input);
}

function from<A>(parser: Parser<A>, serializer: Serializer<A>): Schema<A> {
  return new Schema(parser, serializer);
}

type SchemaDef<A> = {
  [P in keyof A]: Schema<A[P]>;
};

const json: Schema<Json> = new Schema(P.json, S.json);

const boolean: Schema<boolean> = new Schema(P.boolean, S.boolean);
const number: Schema<number> = new Schema(P.number, S.number);
const string: Schema<string> = new Schema(P.string, S.string);

const array = <A>(schema: Schema<A>): Schema<Array<A>> => new Schema(P.array(schema.parser), S.array(schema.serializer));

function object<A>(def: SchemaDef<A>): Schema<A> {
  const pdef = {} as ParserDef<A>;
  const sdef = {} as SerializerDef<A>;
  for (const key in def) {
    const schema = def[key];
    pdef[key] = schema.parser;
    sdef[key] = schema.serializer;
  }

  const parser: Parser<A> = P.object(pdef);
  const serializer: Serializer<A> = S.object(sdef);
  return new Schema(parser, serializer);
}

const objectMap = <A>(schema: Schema<A>): Schema<Record<string, A>> => {
  const parser = P.objectMap(schema.parser);
  const serializer = S.objectMap(schema.serializer);
  return new Schema(parser, serializer);
};

const pair = <L, R>(l: Schema<L>, r: Schema<R>): Schema<[L, R]> => {
  const parser = P.pair(l.parser, r.parser);
  const serializer = S.pair(l.serializer, r.serializer);
  return new Schema(parser, serializer);
};

const triple = <A, B, C>(a: Schema<A>, b: Schema<B>, c: Schema<C>): Schema<[A, B, C]> => {
  const parser = P.triple(a.parser, b.parser, c.parser);
  const serializer = S.triple(a.serializer, b.serializer, c.serializer);
  return new Schema(parser, serializer);
};

const map = <A>(s: Schema<A>): Schema<Map<string, A>> =>
  array(pair(string, s)).dimap(
    (xs) => xs.reduce((acc, [k, v]) => acc.set(k, v), new Map<string, A>()),
    (m) => Array.from(m.entries())
  );

const maybe = <A>(s: Schema<NonNullable<A>>): Schema<Maybe<NonNullable<A>>> => new Schema(P.maybe(s.parser), S.maybe(s.serializer));

const optional = <A>(s: Schema<NonNullable<A>>): Schema<Maybe<NonNullable<A>>> => new Schema(P.optional(s.parser), S.maybe(s.serializer));

const nullable = <A>(s: Schema<A>): Schema<Nullable<A>> => new Schema(P.nullable(s.parser), S.nullable(s.serializer));

const stringLiteral = <T extends string>(str: T): Schema<T> =>
  new Schema(
    P.stringLiteral(str),
    S.string.rmap((input) => {
      if (input !== str) {
        // This should never happen if the type system is used correctly,
        // but we'll return the input anyway to avoid runtime errors
        console.warn(`Warning: Cannot serialize '${input}'. Expected literal '${str}'`);
      }
      return input;
    })
  );

const oneOf = <V>(f: (v: V) => Schema<V>, ss: Array<Schema<V>>): Schema<V> =>
  new Schema(
    P.oneOf(ss.map((s) => s.parser)),
    S.oneOf((v) => f(v).serializer)
  );

function parser<A>(schema: Schema<A>): Parser<A> {
  return schema.parser;
}

function serializer<A>(schema: Schema<A>): Serializer<A> {
  return schema.serializer;
}
