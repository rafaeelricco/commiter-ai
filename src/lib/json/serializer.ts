export { type Infer, Serializer, type SerializerDef, json, boolean, number, string, array, object, objectMap, pair, maybe, nullable, triple, optional, oneOf };

import { Maybe, Nothing, Just, Nullable } from "@/lib/maybe";
import { Json, JsonObject } from "@/lib/json/types";

type Infer<A extends Serializer<any>> = A extends Serializer<infer B> ? B : never;

class Serializer<A> {
  run: (v: A) => Json;

  constructor(f: (v: A) => Json) {
    this.run = f;
  }

  rmap<W>(f: (v: W) => A): Serializer<W> {
    return new Serializer((v) => this.run(f(v)));
  }
}

type SerializerDef<A> = {
  [P in keyof A]: Serializer<A[P]>;
};

const toAny = <T extends Json>(): Serializer<T> => new Serializer((v) => v);

const json: Serializer<Json> = toAny();

const boolean: Serializer<boolean> = toAny();

const number: Serializer<number> = toAny();

const string: Serializer<string> = toAny();

const array = <A>(serializer: Serializer<A>): Serializer<Array<A>> => new Serializer((input: Array<A>) => input.map(serializer.run));

const object = <A>(serializers: SerializerDef<A>): Serializer<A> =>
  new Serializer((input) => {
    const result = {} as JsonObject;
    for (const field in serializers) {
      const serializer = serializers[field];
      const serialized = serializer.run(input[field]);
      result[field] = serialized;
    }

    return result;
  });

const objectMap = <A>(serializer: Serializer<A>): Serializer<Record<string, A>> =>
  new Serializer((input: Record<string, A>) => {
    const result = {} as JsonObject;
    for (const key in input) {
      result[key] = serializer.run(input[key]);
    }
    return result;
  });

const pair = <L, R>(sleft: Serializer<L>, sright: Serializer<R>): Serializer<[L, R]> =>
  new Serializer((input) => {
    const [left, right] = input;
    return [sleft.run(left), sright.run(right)];
  });

const triple = <A, B, C>(sA: Serializer<A>, sB: Serializer<B>, sC: Serializer<C>): Serializer<[A, B, C]> =>
  new Serializer((input) => {
    const [a, b, c] = input;
    return [sA.run(a), sB.run(b), sC.run(c)];
  });

const maybe = <V>(serializer: Serializer<NonNullable<V>>): Serializer<Maybe<NonNullable<V>>> =>
  new Serializer((input) => (input instanceof Nothing ? null : serializer.run(input.value)));

const nullable = <V>(serializer: Serializer<V>): Serializer<Nullable<V>> => new Serializer((input) => (input === null ? null : serializer.run(input)));

const optional = <V>(serializer: Serializer<NonNullable<V>>): Serializer<NonNullable<V> | undefined> =>
  new Serializer((input) => {
    const maybeValue = typeof input === "undefined" ? Nothing<NonNullable<V>>() : Just(input as NonNullable<V>);
    return maybe(serializer).run(maybeValue);
  });

const oneOf = <V>(f: (v: V) => Serializer<V>): Serializer<V> =>
  new Serializer((input) => {
    const serializer = f(input);
    return serializer.run(input);
  });
