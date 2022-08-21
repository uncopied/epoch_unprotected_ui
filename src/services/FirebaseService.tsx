import { initializeApp } from 'firebase/app';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  DocumentSnapshot,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  QueryDocumentSnapshot,
  QuerySnapshot,
  updateDoc,
  where,
} from 'firebase/firestore';
import { FirebaseCollections, FirebaseFields, Status } from '../utils';
import ChainService from './ChainService';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_ID + 'firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_ID + 'appspot.com',
  messagingSenderId: '389375659221',
  appId: '1:389375659221:web:35bee8184ceae82f32a65c',
};

export default class FirebaseService {
  chainService = new ChainService();

  setup = async (): Promise<void> => {
    initializeApp(firebaseConfig);
    // getAnalytics();
  };

  addDocument = async (
    collectionName: FirebaseCollections,
    data: any
  ): Promise<DocumentSnapshot<any>> => {
    const firestore = getFirestore();
    const ref = collection(firestore, collectionName);
    const response = await addDoc(ref, data);
    return await getDoc(response);
  };

  getDocument = async (
    collectionName: FirebaseCollections,
    docIndex: string
  ): Promise<DocumentSnapshot<DocumentData>> => {
    const firestore = getFirestore();
    const ref = doc(firestore, collectionName, docIndex);
    return await getDoc(ref);
  };

  updateDocument = async (
    collectionName: FirebaseCollections,
    docIndex: string,
    data: any
  ): Promise<void> => {
    const firestore = getFirestore();
    const ref = doc(firestore, collectionName, docIndex);
    await updateDoc(ref, data);
  };

  deleteDocument = async (
    collectionName: FirebaseCollections,
    docIndex: string
  ): Promise<void> => {
    const firestore = getFirestore();
    const ref = doc(firestore, collectionName, docIndex);
    return await deleteDoc(ref);
  };

  // getDocuments = async (
  //   collectionName: FirebaseCollections
  // ): Promise<QuerySnapshot<DocumentData>> => {
  //   const firestore = getFirestore();
  //   const ref = collection(firestore, collectionName);
  //   return await getDocs(ref);
  // };

  getDocuments = async (
    collectionName: FirebaseCollections,
    orderByField?: FirebaseFields
  ): Promise<QuerySnapshot<DocumentData>> => {
    const firestore = getFirestore();
    const ref = collection(firestore, collectionName);
    const contracts = query(ref, orderBy(orderByField || ''));
    return await getDocs(contracts);
  };

  getContractForAsset = async (
    index: number,
    collectionName: FirebaseCollections
  ): Promise<QueryDocumentSnapshot<DocumentData> | null> => {
    const firestore = getFirestore();
    const ref = collection(firestore, collectionName);
    const contracts = query(
      ref,
      where(FirebaseFields.AssetIndex, '==', index),
      where(FirebaseFields.Status, '==', Status.Active)
    );
    const snapshot = await getDocs(contracts);
    if (snapshot.docs.length > 0 && snapshot.docs[0].exists()) {
      return snapshot.docs[0];
    } else {
      return null;
    }
  };

  getContractsForSeller = async (
    address: string,
    collectionName: FirebaseCollections
  ): Promise<QueryDocumentSnapshot<DocumentData>[]> => {
    const firestore = getFirestore();
    const ref = collection(firestore, collectionName);
    const contracts = query(
      ref,
      where(FirebaseFields.Seller, '==', address),
      where(FirebaseFields.Status, '==', Status.Active),
      where(FirebaseFields.IsMain, '==', this.chainService.isMainNet)
    );
    const snapshot = await getDocs(contracts);
    return snapshot.docs;
  };
}
