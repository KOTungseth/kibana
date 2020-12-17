/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { coreMock } from '../../../../../core/public/mocks';
import { Storage } from '../../../../kibana_utils/public';
import { EmbeddableStateTransfer } from '.';
import { ApplicationStart, PublicAppInfo } from '../../../../../core/public';
import { EMBEDDABLE_EDITOR_STATE_KEY, EMBEDDABLE_PACKAGE_STATE_KEY } from './types';
import { EMBEDDABLE_STATE_TRANSFER_STORAGE_KEY } from './embeddable_state_transfer';

const createStorage = (): Storage => {
  const createMockStore = () => {
    let innerStore: Record<string, any> = {};
    return {
      getItem: jest.fn().mockImplementation((key) => innerStore[key]),
      setItem: jest.fn().mockImplementation((key, value) => (innerStore[key] = value)),
      removeItem: jest.fn().mockImplementation((key: string) => delete innerStore[key]),
      clear: jest.fn().mockImplementation(() => (innerStore = {})),
    };
  };
  const store = createMockStore();
  const storage = new Storage(store);
  storage.get = jest.fn().mockImplementation((key) => store.getItem(key));
  storage.set = jest.fn().mockImplementation((key, value) => store.setItem(key, value));
  storage.remove = jest.fn().mockImplementation((key: string) => store.removeItem(key));
  storage.clear = jest.fn().mockImplementation(() => store.clear());
  return storage;
};

describe('embeddable state transfer', () => {
  let application: jest.Mocked<ApplicationStart>;
  let stateTransfer: EmbeddableStateTransfer;
  let store: Storage;

  const destinationApp = 'superUltraVisualize';
  const originatingApp = 'superUltraTestDashboard';

  beforeEach(() => {
    const core = coreMock.createStart();
    application = core.application;
    store = createStorage();
    stateTransfer = new EmbeddableStateTransfer(application.navigateToApp, undefined, store);
  });

  it('cannot fetch app name when given no app list', async () => {
    expect(stateTransfer.getAppNameFromId('test')).toBeUndefined();
  });

  it('cannot fetch app name when app id is not in given app list', async () => {
    const appsList = new Map<string, PublicAppInfo>([
      ['testId', { title: 'State Transfer Test App Hello' } as PublicAppInfo],
      ['testId2', { title: 'State Transfer Test App Goodbye' } as PublicAppInfo],
    ]);
    stateTransfer = new EmbeddableStateTransfer(application.navigateToApp, appsList);
    expect(stateTransfer.getAppNameFromId('kibanana')).toBeUndefined();
  });

  it('can fetch app titles when given app list', async () => {
    const appsList = new Map<string, PublicAppInfo>([
      ['testId', { title: 'State Transfer Test App Hello' } as PublicAppInfo],
      ['testId2', { title: 'State Transfer Test App Goodbye' } as PublicAppInfo],
    ]);
    stateTransfer = new EmbeddableStateTransfer(application.navigateToApp, appsList);
    expect(stateTransfer.getAppNameFromId('testId')).toBe('State Transfer Test App Hello');
    expect(stateTransfer.getAppNameFromId('testId2')).toBe('State Transfer Test App Goodbye');
  });

  it('can send an outgoing editor state', async () => {
    await stateTransfer.navigateToEditor(destinationApp, { state: { originatingApp } });
    expect(store.set).toHaveBeenCalledWith(EMBEDDABLE_STATE_TRANSFER_STORAGE_KEY, {
      [EMBEDDABLE_EDITOR_STATE_KEY]: { originatingApp: 'superUltraTestDashboard' },
    });
    expect(application.navigateToApp).toHaveBeenCalledWith('superUltraVisualize', {
      path: undefined,
    });
  });

  it('can send an outgoing editor state and retain other embeddable state keys', async () => {
    store.set(EMBEDDABLE_STATE_TRANSFER_STORAGE_KEY, {
      kibanaIsNowForSports: 'extremeSportsKibana',
    });
    await stateTransfer.navigateToEditor(destinationApp, {
      state: { originatingApp },
    });
    expect(store.set).toHaveBeenCalledWith(EMBEDDABLE_STATE_TRANSFER_STORAGE_KEY, {
      kibanaIsNowForSports: 'extremeSportsKibana',
      [EMBEDDABLE_EDITOR_STATE_KEY]: { originatingApp: 'superUltraTestDashboard' },
    });
    expect(application.navigateToApp).toHaveBeenCalledWith('superUltraVisualize', {
      path: undefined,
    });
  });

  it('can send an outgoing embeddable package state', async () => {
    await stateTransfer.navigateToWithEmbeddablePackage(destinationApp, {
      state: { type: 'coolestType', input: { savedObjectId: '150' } },
    });
    expect(store.set).toHaveBeenCalledWith(EMBEDDABLE_STATE_TRANSFER_STORAGE_KEY, {
      [EMBEDDABLE_PACKAGE_STATE_KEY]: { type: 'coolestType', input: { savedObjectId: '150' } },
    });
    expect(application.navigateToApp).toHaveBeenCalledWith('superUltraVisualize', {
      path: undefined,
    });
  });

  it('can send an outgoing embeddable and retain other embeddable state keys', async () => {
    store.set(EMBEDDABLE_STATE_TRANSFER_STORAGE_KEY, {
      kibanaIsNowForSports: 'extremeSportsKibana',
    });
    await stateTransfer.navigateToWithEmbeddablePackage(destinationApp, {
      state: { type: 'coolestType', input: { savedObjectId: '150' } },
    });
    expect(store.set).toHaveBeenCalledWith(EMBEDDABLE_STATE_TRANSFER_STORAGE_KEY, {
      kibanaIsNowForSports: 'extremeSportsKibana',
      [EMBEDDABLE_PACKAGE_STATE_KEY]: { type: 'coolestType', input: { savedObjectId: '150' } },
    });
    expect(application.navigateToApp).toHaveBeenCalledWith('superUltraVisualize', {
      path: undefined,
    });
  });

  it('can fetch an incoming editor state', async () => {
    store.set(EMBEDDABLE_STATE_TRANSFER_STORAGE_KEY, {
      [EMBEDDABLE_EDITOR_STATE_KEY]: { originatingApp: 'superUltraTestDashboard' },
    });
    const fetchedState = stateTransfer.getIncomingEditorState();
    expect(fetchedState).toEqual({ originatingApp: 'superUltraTestDashboard' });
  });

  it('incoming editor state returns undefined when state is not in the right shape', async () => {
    store.set(EMBEDDABLE_STATE_TRANSFER_STORAGE_KEY, {
      [EMBEDDABLE_EDITOR_STATE_KEY]: { helloSportsKibana: 'superUltraTestDashboard' },
    });
    const fetchedState = stateTransfer.getIncomingEditorState();
    expect(fetchedState).toBeUndefined();
  });

  it('can fetch an incoming embeddable package state', async () => {
    store.set(EMBEDDABLE_STATE_TRANSFER_STORAGE_KEY, {
      [EMBEDDABLE_PACKAGE_STATE_KEY]: { type: 'skisEmbeddable', input: { savedObjectId: '123' } },
    });
    const fetchedState = stateTransfer.getIncomingEmbeddablePackage();
    expect(fetchedState).toEqual({ type: 'skisEmbeddable', input: { savedObjectId: '123' } });
  });

  it('embeddable package state returns undefined when state is not in the right shape', async () => {
    store.set(EMBEDDABLE_STATE_TRANSFER_STORAGE_KEY, {
      [EMBEDDABLE_PACKAGE_STATE_KEY]: { kibanaIsFor: 'sports' },
    });
    const fetchedState = stateTransfer.getIncomingEmbeddablePackage();
    expect(fetchedState).toBeUndefined();
  });

  it('removes embeddable package key when removeAfterFetch is true', async () => {
    store.set(EMBEDDABLE_STATE_TRANSFER_STORAGE_KEY, {
      [EMBEDDABLE_PACKAGE_STATE_KEY]: { type: 'coolestType', input: { savedObjectId: '150' } },
      iSHouldStillbeHere: 'doing the sports thing',
    });
    stateTransfer.getIncomingEmbeddablePackage(true);
    expect(store.get(EMBEDDABLE_STATE_TRANSFER_STORAGE_KEY)).toEqual({
      iSHouldStillbeHere: 'doing the sports thing',
    });
  });

  it('removes editor state key when removeAfterFetch is true', async () => {
    store.set(EMBEDDABLE_STATE_TRANSFER_STORAGE_KEY, {
      [EMBEDDABLE_EDITOR_STATE_KEY]: { originatingApp: 'superCoolFootballDashboard' },
      iSHouldStillbeHere: 'doing the sports thing',
    });
    stateTransfer.getIncomingEditorState(true);
    expect(store.get(EMBEDDABLE_STATE_TRANSFER_STORAGE_KEY)).toEqual({
      iSHouldStillbeHere: 'doing the sports thing',
    });
  });
});
