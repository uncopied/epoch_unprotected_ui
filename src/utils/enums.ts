export enum Chain {
  MainNet = 'mainnet',
  TestNet = 'testnet',
}

export enum Status {
  Pending = 'pending',
  Active = 'active',
  Complete = 'complete',
}

export enum FirebaseFields {
  Seller = 'seller',
  AssetIndex = 'asset_index',
  SalePrice = 'sale_price',
  ContractResult = 'contract_result',
  OrderIndex='order_index',
  Status = 'status',
  IsMain = 'is_main',
  CreatedOn = 'created_on',
  UpdatedOn = 'updated_on',
}

export enum FirebaseCollections {
  AssetSaleContractsCryosphere = 'asset_sale_contracts',
  AssetSaleContractsUnprotected = 'asset_sale_contracts_unprotected',
}

export enum NodeEnv {
  Production = 'production',
}
