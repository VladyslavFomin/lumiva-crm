import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Iyzipay = require('iyzipay');

const SANDBOX_URI = 'https://sandbox-api.iyzipay.com';
const LIVE_URI = 'https://api.iyzipay.com';

export type IyzicoCredentials = {
  apiKey: string;
  secretKey: string;
  sandbox: boolean;
};

export type IyzicoBuyer = {
  id: string;
  name: string;
  surname: string;
  email: string;
  gsmNumber?: string;
  identityNumber?: string;
  registrationAddress: string;
  ip: string;
  city: string;
  country: string;
  zipCode?: string;
};

export type IyzicoBasketItem = {
  id: string;
  name: string;
  category1: string;
  price: string;
};

export type IyzicoCheckoutFormInitResult = {
  status: string;
  token?: string;
  checkoutFormContent?: string;
  paymentPageUrl?: string;
  tokenExpireTime?: number;
  errorMessage?: string;
  errorCode?: string;
};

export type IyzicoCheckoutFormRetrieveResult = {
  status: string;
  paymentStatus?: string;
  paymentId?: string;
  price?: string;
  paidPrice?: string;
  currency?: string;
  basketId?: string;
  conversationId?: string;
  errorMessage?: string;
  errorCode?: string;
};

/**
 * iyzico — оплата через Checkout Form (hosted): карта вводится на стороне iyzico,
 * CRM не обрабатывает и не хранит номера карт.
 * @see https://docs.iyzico.com/en/products/checkout-form
 */
@Injectable()
export class IyzicoApiService {
  private client(creds: IyzicoCredentials) {
    return new Iyzipay({
      apiKey: creds.apiKey.trim(),
      secretKey: creds.secretKey.trim(),
      uri: creds.sandbox ? SANDBOX_URI : LIVE_URI,
    });
  }

  /** Лёгкий, не финансовый вызов — проверяет, что apiKey/secretKey валидны. */
  async verifyAccess(creds: IyzicoCredentials): Promise<void> {
    const iyzipay = this.client(creds);
    const result = await new Promise<any>((resolve, reject) => {
      iyzipay.binNumber.retrieve(
        {
          locale: Iyzipay.LOCALE.EN,
          conversationId: `verify-${Date.now()}`,
          binNumber: '554960',
        },
        (err: unknown, res: any) => {
          if (err) reject(err);
          else resolve(res);
        },
      );
    });
    if (!result || typeof result !== 'object') {
      throw new Error('iyzico: пустой ответ от API');
    }
    if (result.status !== 'success') {
      const code = result.errorCode ? ` (${result.errorCode})` : '';
      throw new Error(`iyzico: ${result.errorMessage || 'ошибка авторизации'}${code}`);
    }
  }

  async initializeCheckoutForm(
    creds: IyzicoCredentials,
    params: {
      conversationId: string;
      price: number;
      currency: 'TRY' | 'EUR' | 'USD' | 'GBP';
      basketId: string;
      callbackUrl: string;
      buyer: IyzicoBuyer;
      basketItems: IyzicoBasketItem[];
      locale?: 'tr' | 'en';
    },
  ): Promise<IyzicoCheckoutFormInitResult> {
    const iyzipay = this.client(creds);
    const priceStr = params.price.toFixed(2);
    const address = {
      contactName: `${params.buyer.name} ${params.buyer.surname}`.trim(),
      city: params.buyer.city,
      country: params.buyer.country,
      address: params.buyer.registrationAddress,
      zipCode: params.buyer.zipCode || '00000',
    };
    const request = {
      locale: params.locale === 'tr' ? Iyzipay.LOCALE.TR : Iyzipay.LOCALE.EN,
      conversationId: params.conversationId,
      price: priceStr,
      paidPrice: priceStr,
      currency: params.currency,
      basketId: params.basketId,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: params.callbackUrl,
      buyer: {
        id: params.buyer.id,
        name: params.buyer.name,
        surname: params.buyer.surname,
        gsmNumber: params.buyer.gsmNumber || undefined,
        email: params.buyer.email,
        identityNumber: params.buyer.identityNumber || '11111111111',
        registrationAddress: params.buyer.registrationAddress,
        ip: params.buyer.ip,
        city: params.buyer.city,
        country: params.buyer.country,
        zipCode: params.buyer.zipCode || undefined,
      },
      shippingAddress: address,
      billingAddress: address,
      basketItems: params.basketItems.map((i) => ({
        id: i.id,
        name: i.name,
        category1: i.category1,
        itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
        price: Number(i.price).toFixed(2),
      })),
    };
    const result = await new Promise<IyzicoCheckoutFormInitResult>((resolve, reject) => {
      iyzipay.checkoutFormInitialize.create(request, (err: unknown, res: IyzicoCheckoutFormInitResult) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
    if (!result || result.status !== 'success') {
      throw new Error(
        `iyzico: ${result?.errorMessage || 'не удалось создать форму оплаты'}${result?.errorCode ? ` (${result.errorCode})` : ''}`,
      );
    }
    return result;
  }

  async retrieveCheckoutForm(
    creds: IyzicoCredentials,
    params: { token: string; conversationId: string; locale?: 'tr' | 'en' },
  ): Promise<IyzicoCheckoutFormRetrieveResult> {
    const iyzipay = this.client(creds);
    const result = await new Promise<IyzicoCheckoutFormRetrieveResult>((resolve, reject) => {
      iyzipay.checkoutForm.retrieve(
        {
          locale: params.locale === 'tr' ? Iyzipay.LOCALE.TR : Iyzipay.LOCALE.EN,
          conversationId: params.conversationId,
          token: params.token,
        },
        (err: unknown, res: IyzicoCheckoutFormRetrieveResult) => {
          if (err) reject(err);
          else resolve(res);
        },
      );
    });
    if (!result || typeof result !== 'object') {
      throw new Error('iyzico: пустой ответ от API при проверке статуса оплаты');
    }
    return result;
  }
}
