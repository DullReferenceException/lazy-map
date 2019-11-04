import mapping, { MappingSpec } from '../lib/mapping';

const sourceObject = { 
  first: 'Lando', 
  last: 'Calrissian', 
  mobile: '555-123-1234',
  home: '555-555-5555'
};

type Source = typeof sourceObject;
type Person = { name: string, phone: string, contactInfo: string };

describe('mapping', () => {
  let spec: MappingSpec<Source, Person>;
  let toPerson: (source: Source) => Person;

  beforeEach(() => {
    spec = {
      name: jest.fn(details => `${details.first} ${details.last}`),
      phone: jest.fn(details => details.mobile || details.home),
      contactInfo() {
        return this.name + '\n' + this.phone;
      }
    };
    
    toPerson = mapping<Source, Person>(spec);    
  });

  it('creates a function to generate mapped objects', () => {
    const person: Person = toPerson(sourceObject);
    expect(typeof person).toEqual('object');
  });

  it('does not eagerly calculate any properties', () => {
    toPerson(sourceObject);

    expect(spec.name).not.toHaveBeenCalled();
    expect(spec.phone).not.toHaveBeenCalled();
  });

  it('supports self-referencing property functions', () => {
    const person = toPerson(sourceObject);

    expect(person.contactInfo).toEqual('Lando Calrissian\n555-123-1234');
  });

  describe('response', () => {
    let person: Person;

    beforeEach(() => {
      person = toPerson(sourceObject);
    });

    it('serializes as expected', () => {
      (person as any).foo = 'bar';
      expect(JSON.parse(JSON.stringify(person))).toEqual({
        name: 'Lando Calrissian',
        phone: '555-123-1234',
        contactInfo: 'Lando Calrissian\n555-123-1234',
        foo: 'bar'
      });
    });

    describe('get handler', () => {
      it('lazily calls the conversion function', () => {
        expect(spec.name).not.toBeCalled();
        expect(spec.phone).not.toBeCalled();

        expect(person.name).toEqual('Lando Calrissian');
        expect(spec.name).toBeCalledTimes(1);

        expect(person.phone).toEqual('555-123-1234');
        expect(spec.phone).toBeCalledTimes(1);
      });

      it('memoizes conversion results', () => {
        const name1 = person.name;
        const name2 = person.name;

        expect(name1).toEqual(name2);
        expect(spec.name).toBeCalledTimes(1);
      });

      it('retrieves property assignments', () => {
        person.name = 'Updated Name';

        expect(person.name).toEqual('Updated Name');
      });

      it('does not return a property if it has been deleted', () => {
        delete person.name;

        expect(person.name).toEqual(undefined);
      });
    });

    describe('has handler', () => {
      it('returns false if the property is not present', () => {
        expect('foo' in person).toEqual(false);
      });

      it('returns true for lazily-mapped properties', () => {
        expect('name' in person).toEqual(true);
      });

      it('returns true for "expando" properties', () => {
        (person as any).feeling = 'sad';
        expect('feeling' in person).toEqual(true);
      });
    });

    describe('ownKeys handler', () => {
      it('enumerates all lazy property keys', () => {
        const keys = getKeys();

        expect(keys.has('name')).toEqual(true);
        expect(keys.has('phone')).toEqual(true);
      });

      it('includes expando property keys', () => {
        (person as any).address = '123 Street St.';

        const keys = getKeys();

        expect(keys.has('name')).toEqual(true);
        expect(keys.has('phone')).toEqual(true);
        expect(keys.has('address')).toEqual(true);
      });

      it('excludes deleted keys', () => {
        delete person.name;

        const keys = getKeys();

        expect(keys.has('name')).toEqual(false);
      });

      function getKeys() {
        return new Set(Object.keys(person));
      }
    });

    describe('getOwnPropertyDescriptor', () => {
      it('returns undefined for non-existing properties', () => {
        const descriptor = Reflect.getOwnPropertyDescriptor(person, 'foo');
        expect(descriptor).toEqual(undefined);
      });
    });
  });
});
