import WalletConnect from '@walletconnect/client';
import { IInternalEvent } from '@walletconnect/types';
import { LogicSigAccount } from 'algosdk';
import { serverTimestamp } from 'firebase/firestore';
import React, { ChangeEvent } from 'react';
import './App.css';
import ChainService from './services/ChainService';
import ContractService from './services/ContractService';
import FirebaseService from './services/FirebaseService';
import TransactionService from './services/TransactionService';
import WalletService from './services/WalletService';
import {
  ASSET_SALE_FUNCTION_UNPROTECTED,
  BUY_FAIL_MSG,
  BUY_SUCCESS_MSG_UNPROTECTED,
  DEFAULT_PRICE,
  ellipseAddress,
  FirebaseCollections,
  FirebaseFields,
  SButton,
  Status,
  TOTAL_COUNT_UNPROTECTED,
} from './utils';

interface AppProps {}

interface AppState {
  connector: WalletConnect;
  firebaseService: FirebaseService;
  chainService: ChainService;
  contractService: ContractService;
  transactionService: TransactionService;
  loading: boolean;
  loadingPutOnSale: boolean;
  waitingOnChain: boolean;
  address: string;
  connected: boolean;
  accounts: string[];
  contracts: any[];
  // for putting on sale
  salePrice: number | string;
  assetIndex: number | string;
  orderIndex: number | string;
}

const INITIAL_STATE: AppState = {
  connector: new WalletService().connector,
  firebaseService: new FirebaseService(),
  chainService: new ChainService(),
  contractService: new ContractService(),
  transactionService: new TransactionService(),
  loading: true,
  loadingPutOnSale: false,
  waitingOnChain: false,
  address: '',
  connected: false,
  accounts: [],
  contracts: [],
  salePrice: '',
  assetIndex: '',
  orderIndex: '',
};

class App extends React.Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);
    const { connected, accounts } = INITIAL_STATE.connector;
    this.state = {
      ...INITIAL_STATE,
      connected,
      accounts,
      address: accounts[0],
    };
  }

  componentDidMount() {
    this.subscribeToWalletEvents();
    this.setupFirebase();
    console.log('on mainnet:', this.state.chainService.isMainNet);
  }

  setupFirebase = async () => {
    await this.state.firebaseService.setup();
    await this.loadContracts();
    this.setState({ loading: false });
  };

  subscribeToWalletEvents = () => {
    const connector = this.state.connector;
    if (!connector) return;
    connector.on('connect', (error: Error | null, payload: any) => {
      window.location.reload();
      if (error) throw error;
      this.onConnect(payload);
    });
    connector.on(
      'session_update',
      async (error: Error | null, payload: any) => {
        if (error) throw error;
        const accounts = payload.params[0].accounts;
        this.onSessionUpdate(accounts);
      }
    );
    connector.on('disconnect', (error: Error | null, payload: any) => {
      if (error) throw error;
      this.onDisconnect();
    });
    if (connector.connected) {
      const { accounts } = connector;
      this.setState({
        connected: true,
        accounts,
        address: accounts[0],
      });
      this.onSessionUpdate(accounts);
    }
    this.setState({ connector });
  };

  onConnect = (payload: IInternalEvent) => {
    const { accounts } = payload.params[0];
    this.setState({
      connected: true,
      accounts,
      address: accounts[0],
    });
  };

  onSessionUpdate = (accounts: string[]) => {
    this.setState({ accounts, address: accounts[0] });
  };

  onDisconnect = () => {
    this.setState({ ...INITIAL_STATE });
  };

  killSession = () => {
    const { connector } = this.state;
    if (connector) connector.killSession();
    this.setState({ ...INITIAL_STATE });
  };

  // asset management
  loadContracts = async () => {
    const contracts: any[] = [];
    await this.state.firebaseService
      .getDocuments(
        FirebaseCollections.AssetSaleContractsUnprotected,
        FirebaseFields.OrderIndex
      )
      .then(
        (snapshot) =>
          snapshot.forEach((contract) => {
            const contractData = contract.data();
            if (
              contractData[FirebaseFields.Status] === Status.Active &&
              contractData[FirebaseFields.Seller] !== this.state.address &&
              contractData[FirebaseFields.IsMain] ===
                this.state.chainService.isMainNet
            ) {
              contracts.push(contract);
            }
          }),
        (error) => {
          console.log('Error in loading contracts:', error);
        }
      );

    this.setState({ contracts });
  };

  sellAsset = async (): Promise<void> => {
    const {
      address: seller,
      firebaseService,
      chainService,
      contractService,
      transactionService,
      assetIndex,
      orderIndex,
      salePrice,
    } = this.state;

    if (seller && salePrice) {
      try {
        const contract = await contractService.generateAssetSaleContract(
          seller,
          assetIndex,
          salePrice,
          ASSET_SALE_FUNCTION_UNPROTECTED
        );
        const contractResult = contract.result;
        const response = await firebaseService.addDocument(
          FirebaseCollections.AssetSaleContractsUnprotected,
          {
            [FirebaseFields.Seller]: seller,
            [FirebaseFields.AssetIndex]: assetIndex,
            [FirebaseFields.OrderIndex]: orderIndex,
            [FirebaseFields.SalePrice]: salePrice,
            [FirebaseFields.ContractResult]: contractResult,
            [FirebaseFields.Status]: Status.Pending,
            [FirebaseFields.IsMain]: chainService.isMainNet,
            [FirebaseFields.CreatedOn]: serverTimestamp(),
          }
        );
        // confirm transaction
        await transactionService.sellAsset({
          seller,
          assetIndex,
          contractResult,
        });
        // update status to active
        firebaseService.updateDocument(
          FirebaseCollections.AssetSaleContractsUnprotected,
          response.id,
          {
            status: Status.Active,
            updated_on: serverTimestamp(),
          }
        );
        alert(`Successfully put asset on sale.`);
        this.setState({
          orderIndex: Number(orderIndex || 0) + 1,
          assetIndex: '',
          loadingPutOnSale: false,
        });
      } catch (error) {
        alert(`Failed to put asset on sale, please refresh and try again.`);
        this.setState({ loadingPutOnSale: false });
        throw error;
      }
    }
  };

  buyAsset = async (): Promise<void> => {
    const {
      connector,
      address: buyer,
      contracts,
      transactionService,
      firebaseService,
    } = this.state;

    if (!buyer) {
      connector.createSession();
      return;
    }

    const contractResp = contracts[0];
    const contract = contractResp.data();
    if (!contract) {
      console.log('no contract');
      return;
    }

    this.setState({ waitingOnChain: true });
    const contractSig = await this.getContractSig(contract);
    const seller = contract[FirebaseFields.Seller];
    const price = contract[FirebaseFields.SalePrice];
    const assetIndex = contract[FirebaseFields.AssetIndex];

    if (contractSig && seller && price) {
      try {
        // confirm transaction
        await transactionService.buyAsset({
          buyer,
          seller,
          assetIndex,
          price,
          contractSig,
        });
        firebaseService.updateDocument(
          FirebaseCollections.AssetSaleContractsUnprotected,
          contractResp.id,
          {
            status: Status.Complete,
            updated: serverTimestamp(),
            buyer,
          }
        );
        this.setState({ waitingOnChain: false });
        this.setState({ contracts: contracts.slice(1) });
        alert(BUY_SUCCESS_MSG_UNPROTECTED);
      } catch (error) {
        this.setState({ waitingOnChain: false });
        alert(BUY_FAIL_MSG);
        throw error;
      }
    }
  };

  getContractSig = async (contractData: any): Promise<LogicSigAccount> => {
    const contractResult = contractData[FirebaseFields.ContractResult];
    const contract = new Uint8Array(Buffer.from(contractResult, 'base64'));
    return new LogicSigAccount(contract);
  };

  editionDisplay = (): string => {
    const count = TOTAL_COUNT_UNPROTECTED - this.state.contracts.length;
    return `${count}/${TOTAL_COUNT_UNPROTECTED} edition`;
  };

  onSalePriceChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const salePrice: number = Number(event.target.value) ?? DEFAULT_PRICE;
    this.setState({ salePrice });
  };

  onAssetIndexChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const assetIndex: number = Number(event.target.value);
    this.setState({ assetIndex });
  };

  onOrderIndexChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const orderIndex: number = Number(event.target.value);
    this.setState({ orderIndex });
  };

  disablePutOnSale = (): boolean => {
    const { orderIndex, assetIndex, salePrice, loadingPutOnSale } = this.state;
    return !orderIndex || !assetIndex || !salePrice || loadingPutOnSale;
  };

  render() {
    const {
      connector,
      address,
      contracts,
      waitingOnChain,
      orderIndex,
      assetIndex,
      salePrice,
    } = this.state;
    const connectWallet = async () => connector.createSession();
    const handleBuy = async () => this.buyAsset();
    const handleSell = async () => {
      // set put on sale loading
      this.setState({ loadingPutOnSale: true });
      this.sellAsset();
    };
    const seller = contracts?.length
      ? contracts[0][FirebaseFields.Seller]
      : null;

    return this.state.loading && address ? (
      <div className="vh-100 flex items-center justify-center">loading...</div>
    ) : (
      <div className="vh-100 flex items-center justify-around">
        {address ? (
          <div className="w-100 flex items-start justify-around">
            <div className="w5 flex flex-column items-center">
              <SButton onClick={this.killSession}>Disconnect</SButton>
              <span className="blue mt1">{ellipseAddress(address)}</span>
            </div>
            <div className="w5 flex flex-column items-center">
              <SButton
                onClick={handleBuy}
                disabled={
                  !contracts.length || seller === address || waitingOnChain
                }
              >
                Acquire NFT
              </SButton>
              {waitingOnChain && (
                <span className="mt1">
                  Open Pera Wallet to complete transaction…
                </span>
              )}
            </div>

            {/* <div>{this.editionDisplay()}</div>

            <div className="flex flex-column items-center justify-between">
              <div className="flex items-end">
                <SButton
                  className="w-third pointer mr3"
                  onClick={handleSell}
                  disabled={this.disablePutOnSale()}
                >
                  {this.state.loadingPutOnSale
                    ? 'Please wait...'
                    : 'Put on Sale'}
                </SButton>
              </div>
              <div className="flex mt1">
                <input
                  className="pa2 ba br2 mr2 w3"
                  type="number"
                  min="1"
                  step="1"
                  name="orderIndex"
                  value={orderIndex}
                  onChange={this.onOrderIndexChange}
                  required
                  placeholder="No."
                />
                <input
                  className="pa2 ba br2 mr2"
                  type="number"
                  min="1"
                  step="1"
                  name="assetIndex"
                  value={assetIndex}
                  onChange={this.onAssetIndexChange}
                  required
                  placeholder="Asset Index"
                />
                <input
                  className="pa2 ba br2"
                  type="number"
                  min="1"
                  step="1"
                  name="salePrice"
                  value={salePrice}
                  onChange={this.onSalePriceChange}
                  required
                  placeholder="Price in Algo"
                />
              </div>
            </div> */}
          </div>
        ) : (
          <SButton onClick={connectWallet}>Connect Algorand Wallet</SButton>
        )}
      </div>
    );
  }
}

export default App;
