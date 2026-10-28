import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AltmanStorage } from '../storage/altmanStorage';
import { PostmanCollection, PostmanEnvironment } from '../types';

describe('AltmanStorage', () => {
  let tmpDir: string;
  let storage: AltmanStorage;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'altman-test-'));
    // AltmanStorage takes a mock Uri-like object with fsPath
    storage = new AltmanStorage({ fsPath: tmpDir } as any);
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('should save and list collections with collection variables and scripts', () => {
    const coll: PostmanCollection = {
      info: {
        name: 'Test Payments API',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: [],
      variable: [
        { key: 'baseUrl', value: 'https://api.payments.com', type: 'string' }
      ],
      event: [
        {
          listen: 'prerequest',
          script: {
            type: 'text/javascript',
            exec: ['pm.collectionVariables.set("trace_id", "12345");']
          }
        }
      ]
    };

    storage.saveCollection(coll);
    const listed = storage.listCollections();
    expect(listed.length).to.equal(1);
    expect(listed[0].info.name).to.equal('Test Payments API');
    expect(listed[0].variable?.length).to.equal(1);
    expect(listed[0].variable?.[0].key).to.equal('baseUrl');
    expect(listed[0].event?.length).to.equal(1);
  });

  it('should add a request to collection and delete a request from collection', () => {
    const coll: PostmanCollection = {
      info: {
        name: 'Order API',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: [
        {
          name: 'Get Order',
          request: {
            method: 'GET',
            url: { raw: 'https://api.example.com/orders/1' },
            header: []
          }
        }
      ]
    };

    storage.saveCollection(coll);

    // 1. Add new request
    const loaded = storage.getCollection('Order API')!;
    expect(loaded.item.length).to.equal(1);

    loaded.item.push({
      name: 'Create Order',
      request: {
        method: 'POST',
        url: { raw: 'https://api.example.com/orders' },
        header: []
      }
    });
    storage.saveCollection(loaded);

    const afterAdd = storage.getCollection('Order API')!;
    expect(afterAdd.item.length).to.equal(2);
    expect(afterAdd.item[1].name).to.equal('Create Order');

    // 2. Delete request
    afterAdd.item = afterAdd.item.filter(i => i.name !== 'Get Order');
    storage.saveCollection(afterAdd);

    const afterDelete = storage.getCollection('Order API')!;
    expect(afterDelete.item.length).to.equal(1);
    expect(afterDelete.item[0].name).to.equal('Create Order');
  });

  it('should delete a collection', () => {
    const coll: PostmanCollection = {
      info: {
        name: 'To Be Deleted',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: []
    };

    storage.saveCollection(coll);
    expect(storage.listCollections().length).to.equal(1);

    const deleted = storage.deleteCollection('To Be Deleted');
    expect(deleted).to.be.true;
    expect(storage.listCollections().length).to.equal(0);
  });

  it('should save, list, and delete environments', () => {
    const env: PostmanEnvironment = {
      name: 'Staging Env',
      values: [
        { key: 'host', value: 'staging.api.com', enabled: true, type: 'default' }
      ]
    };

    storage.saveEnvironment(env);
    const listed = storage.listEnvironments();
    expect(listed.length).to.equal(1);
    expect(listed[0].name).to.equal('Staging Env');

    const deleted = storage.deleteEnvironment('Staging Env');
    expect(deleted).to.be.true;
    expect(storage.listEnvironments().length).to.equal(0);
  });

  it('should update existing collection scripts without creating a duplicate file', () => {
    // 1. Initial collection file on disk (with underscores in filename)
    const collDir = path.join(tmpDir, '.altman', 'collections');
    fs.mkdirSync(collDir, { recursive: true });
    const initialColl: PostmanCollection = {
      info: {
        _postman_id: 'coll-uuid-001',
        name: 'Demo Collection',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      item: [],
      variable: []
    };
    fs.writeFileSync(path.join(collDir, 'Demo_Collection.json'), JSON.stringify(initialColl, null, 2), 'utf8');

    // Verify it is listed as single collection
    let collections = storage.listCollections();
    expect(collections.length).to.equal(1);
    expect(collections[0].info.name).to.equal('Demo Collection');

    // 2. Update collection pre-request script
    const toUpdate: PostmanCollection = {
      ...initialColl,
      event: [
        {
          listen: 'prerequest',
          script: {
            type: 'text/javascript',
            exec: ['console.log(Math.random());', 'console.log(_.chunk([1,2,3], 2));']
          }
        }
      ]
    };
    storage.saveCollection(toUpdate, 'Demo Collection');

    // 3. Verify exactly 1 collection file exists on disk and listCollections returns 1
    const files = fs.readdirSync(collDir).filter(f => f.endsWith('.json'));
    expect(files.length).to.equal(1);

    collections = storage.listCollections();
    expect(collections.length).to.equal(1);
    expect(collections[0].info.name).to.equal('Demo Collection');
    expect(collections[0].event?.length).to.equal(1);
    expect(collections[0].event?.[0].script?.exec?.[0]).to.equal('console.log(Math.random());');
  });
});
