import { ScriptConfig } from '@ckb-lumos/config-manager';
import {
  AbstractWallet,
  ConnectStatus,
  Signer,
  dummy,
  ObservableUnipassWallet,
  ObservableNonAcpPwLockWallet,
} from 'ckit';
import { CkitConfig, CkitProvider } from 'ckit/dist/providers/CkitProvider';
import { randomHexString } from 'ckit/dist/utils';
import { autorun } from 'mobx';
import { useLocalObservable } from 'mobx-react-lite';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { createContainer } from 'unstated-next';

export type CurrentWalletIndex = number | null;

export interface WalletConnectError {
  error: Error;
  index: number;
}

function useWallet() {
  const wallets = useLocalObservable<AbstractWallet[]>(() => [
    new dummy.DummyWallet() as AbstractWallet,
    new ObservableUnipassWallet() as AbstractWallet,
  ]);
  const [currentWalletIndex, setCurrentWalletIndex] = useState<CurrentWalletIndex>(null);
  const [error, setError] = useState<WalletConnectError | null>(null);
  const [visible, setVisible] = useState(false);

  const setModalVisible = useCallback((visible: boolean) => {
    setVisible(visible);
    setError(null);
  }, []);

  const selectedWallet = useMemo(
    () => (currentWalletIndex === null ? undefined : wallets[currentWalletIndex]),
    [currentWalletIndex, wallets],
  );

  useEffect(() => {
    const provider = new CkitProvider();
    // TODO replace with env or config file
    const randomScriptConfig = (): ScriptConfig => ({
      HASH_TYPE: 'type',
      DEP_TYPE: 'code',
      CODE_HASH: randomHexString(64),
      TX_HASH: randomHexString(64),
      INDEX: '0x0',
    });

    const config: CkitConfig = {
      PREFIX: 'ckt',
      SCRIPTS: {
        ANYONE_CAN_PAY: randomScriptConfig(),
        PW_NON_ANYONE_CAN_PAY: randomScriptConfig(),
        PW_ANYONE_CAN_PAY: randomScriptConfig(),
        SECP256K1_BLAKE160: randomScriptConfig(),
        SUDT: randomScriptConfig(),
      },
    };

    void provider.init(config).then(() => wallets.push(new ObservableNonAcpPwLockWallet(provider)));
  }, []);

  useEffect(
    () =>
      autorun(() => {
        if (!wallets) return;
        wallets.forEach((wallet, index) => {
          const onConnectStatusChanged = (connectStatus: ConnectStatus) => {
            if (connectStatus === 'disconnected') {
              const connectedIndex = wallets.findIndex((w) => w.connectStatus === 'connected');
              if (-1 === connectedIndex) {
                setCurrentWalletIndex(null);
              } else {
                setCurrentWalletIndex(connectedIndex);
              }
            }
            if (connectStatus === 'connected') {
              setModalVisible(false);
              const connectedIndex = wallets.findIndex((w) => w.name === wallet.name);
              if (-1 === connectedIndex) {
                throw new Error('exception: wallet could not be found');
              } else {
                setCurrentWalletIndex(connectedIndex);
              }
            }
          };
          wallet.on('connectStatusChanged', onConnectStatusChanged);
          wallet.on('error', (err) => setError({ error: err as Error, index: index }));
        });
      }),
    [],
  );

  return {
    currentWalletIndex,
    setCurrentWalletIndex,
    wallets,
    selectedWallet,
    error,
    setError,
    visible,
    setModalVisible,
  };
}

interface SignerAddress {
  address: string | undefined;
}

export function useSigner(signer: Signer | undefined): SignerAddress {
  const [address, setAddress] = useState<string>();

  useEffect(() => {
    setAddress(undefined);
    if (!signer) return;
    void signer.getAddress().then(setAddress);
  }, [signer]);

  return { address };
}

export const WalletContainer = createContainer(useWallet);

export const displayWalletName = (name: string | undefined): string => {
  switch (name) {
    case 'ObservableUnipassWallet':
      return 'unipass';
    case 'ObservableNonAcpPwLockWallet':
      return 'metamask';
    default:
      return 'unknown';
  }
};