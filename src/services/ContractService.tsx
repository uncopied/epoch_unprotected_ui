export default class ContractService {
  generateAssetSaleContract = async (
    seller: string,
    asset: number | string,
    price: number | string,
    functionName: string
  ): Promise<any> => {
    try {
      const url = `https://us-central1-${process.env.REACT_APP_FIREBASE_ID}.cloudfunctions.net/${functionName}?seller=${seller}&asset=${asset}&price=${price}`;
      console.log(url)
      const request = await fetch(url);
      return await request.json();
    } catch (error) {
      throw error;
    }
  };

  getAssetMetadataFromIpfs = async (url: string): Promise<any> => {
    try {
      return fetch(url).then((response) => response?.json());
    } catch (error) {
      throw error;
    }
  };
}
