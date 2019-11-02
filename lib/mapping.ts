export type MappingSpec<From, To> = {
  [K in keyof To]: (from: From) => To[K];
}

function mapping<From, To>(spec: MappingSpec<From, To>): (source: From) => To {
  return (source: From) => proxyFactory<From, To>(spec, source);
}

type ProxyTarget<From, To> = {
  spec: MappingSpec<From, To>,
  source: From,
  store: { [K in keyof To]: To[K] },
  deletedKeys: Set<string | number | Symbol>
}

type Key = string | number | Symbol;

const handlers = {
  has<From, To>(target: ProxyTarget<From, To>, key: Key) {
    return (key in target.store) || (key in target.spec);
  },
  get<From, To>(target: ProxyTarget<From, To>, prop: keyof To, self: To) {
    if (target.deletedKeys.has(prop)) {
      return undefined;
    }
    if (!(prop in target.store) && (prop in target.spec)) {
      target.store[prop] = target.spec[prop].call(self, target.source);
    }
    return target.store[prop];
  },
  set<From, To, K extends keyof To>(
    target: ProxyTarget<From, To>, 
    prop: keyof To, 
    value: To[K]
  ) {
    target.deletedKeys.delete(prop);
    return target.store[prop] = value;
  },
  deleteProperty<From, To, K extends keyof To>(
    target: ProxyTarget<From, To>, 
    prop: K
  ) {
    delete target.store[prop];
    target.deletedKeys.add(prop);
    return true;
  },
  ownKeys<From, To>(target: ProxyTarget<From, To>) {
    const allKeys = Object.keys(target.spec).concat(Object.keys(target.store));
    return Array.from(new Set(allKeys))
      .filter(key => !target.deletedKeys.has(key));
  },
  getOwnPropertyDescriptor<From, To, K extends keyof To>(
    target: ProxyTarget<From, To>, prop: K
  ) {
    if (prop in target.store) {
      return Reflect.getOwnPropertyDescriptor(target.store, prop);
    } else if (prop in target.spec) {
      return {
        enumerable: true,
        writable: true,
        configurable: true
      };
    }
  }
};

function proxyFactory<From, To>(spec: MappingSpec<From, To>, source: From) {
  const target: ProxyTarget<From, To> = {
    spec,
    source,
    store: {} as { [K in keyof To]: To[K] },
    deletedKeys: new Set()
  };

  return new Proxy(target, handlers) as unknown as To;
}

export default mapping;
