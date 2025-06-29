import ConfigService from './configService';

export interface LhdnInvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  supplier: {
    tin: string;
    name: string;
    address: string;
    email?: string;
    phone?: string;
  };
  buyer: {
    tin?: string;
    name: string;
    address: string;
    email?: string;
    phone?: string;
    idType?: string;
    idValue?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    taxType?: string;
    taxRate?: number;
    taxAmount?: number;
  }>;
  totalAmount: number;
  totalTaxAmount: number;
  totalIncludingTax: number;
  currency: string;
  paymentMethod?: string;
  notes?: string;
}

export interface LhdnResponse {
  success: boolean;
  message: string;
  data?: any;
  invoiceUuid?: string;
  submissionUid?: string;
  longId?: string;
  status?: string;
}

class LhdnService {
  private static instance: LhdnService;
  private configService: ConfigService;

  private constructor() {
    this.configService = ConfigService.getInstance();
  }

  static getInstance(): LhdnService {
    if (!LhdnService.instance) {
      LhdnService.instance = new LhdnService();
    }
    return LhdnService.instance;
  }

  async isEnabled(): Promise<boolean> {
    try {
      const enabled = await this.configService.getConfig('lhdnMyInvoisEnabled');
      return enabled === true;
    } catch (error) {
      console.error('Error checking LHDN status:', error);
      return false;
    }
  }

  async getGatewayUrl(): Promise<string> {
    try {
      const url = await this.configService.getConfig('lhdnGatewayUrl');
      return url || 'http://localhost:3000';
    } catch (error) {
      console.error('Error getting gateway URL:', error);
      return 'http://localhost:3000';
    }
  }

  private async makeGatewayRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const enabled = await this.isEnabled();
    if (!enabled) {
      throw new Error('LHDN MyInvois integration is disabled');
    }

    const gatewayUrl = await this.getGatewayUrl();
    const clientId = await this.configService.getConfig('lhdnClientId');
    const clientSecret = await this.configService.getConfig('lhdnClientSecret');

    if (!clientId || !clientSecret) {
      throw new Error('LHDN credentials not configured');
    }

    const headers = {
      'Content-Type': 'application/json',
      'X-Client-ID': clientId,
      'X-Client-Secret': clientSecret,
      ...options.headers,
    };

    try {
      const response = await fetch(`${gatewayUrl}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LHDN Gateway error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('LHDN Gateway request failed:', error);
      throw error;
    }
  }

  async testConnection(): Promise<LhdnResponse> {
    try {
      const enabled = await this.isEnabled();
      if (!enabled) {
        return {
          success: false,
          message: 'LHDN MyInvois integration is disabled'
        };
      }

      const response = await this.makeGatewayRequest('/api/test');
      return {
        success: true,
        message: 'Connection successful',
        data: response
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  async getAccessToken(): Promise<string> {
    try {
      const response = await this.makeGatewayRequest('/api/auth/token', {
        method: 'POST'
      });
      
      if (response.access_token) {
        return response.access_token;
      }
      
      throw new Error('No access token received');
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw error;
    }
  }

  async submitInvoice(invoiceData: LhdnInvoiceData): Promise<LhdnResponse> {
    try {
      const enabled = await this.isEnabled();
      if (!enabled) {
        return {
          success: false,
          message: 'LHDN MyInvois integration is disabled'
        };
      }

      // Get taxpayer info from config
      const taxpayerTin = await this.configService.getConfig('lhdnTaxpayerTin');
      const environment = await this.configService.getConfig('lhdnEnvironment');
      const autoSubmit = await this.configService.getConfig('lhdnAutoSubmit');

      if (!taxpayerTin) {
        return {
          success: false,
          message: 'Taxpayer TIN not configured'
        };
      }

      // Prepare invoice payload for MyInvois gateway
      const payload = {
        ...invoiceData,
        supplier: {
          ...invoiceData.supplier,
          tin: taxpayerTin
        },
        environment: environment || 'sandbox',
        autoSubmit: autoSubmit || false
      };

      const response = await this.makeGatewayRequest('/api/invoices/submit', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      return {
        success: true,
        message: 'Invoice submitted successfully',
        data: response,
        invoiceUuid: response.invoiceUuid,
        submissionUid: response.submissionUid,
        longId: response.longId,
        status: response.status
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Invoice submission failed'
      };
    }
  }

  async getInvoiceStatus(invoiceUuid: string): Promise<LhdnResponse> {
    try {
      const response = await this.makeGatewayRequest(`/api/invoices/${invoiceUuid}/status`);
      
      return {
        success: true,
        message: 'Status retrieved successfully',
        data: response,
        status: response.status
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get invoice status'
      };
    }
  }

  async cancelInvoice(invoiceUuid: string, reason: string): Promise<LhdnResponse> {
    try {
      const response = await this.makeGatewayRequest(`/api/invoices/${invoiceUuid}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });

      return {
        success: true,
        message: 'Invoice cancelled successfully',
        data: response
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Invoice cancellation failed'
      };
    }
  }

  async validateInvoice(invoiceData: LhdnInvoiceData): Promise<LhdnResponse> {
    try {
      const validationMode = await this.configService.getConfig('lhdnValidationMode');
      
      const response = await this.makeGatewayRequest('/api/invoices/validate', {
        method: 'POST',
        body: JSON.stringify({
          ...invoiceData,
          validationMode: validationMode || 'strict'
        })
      });

      return {
        success: true,
        message: 'Invoice validation successful',
        data: response
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Invoice validation failed'
      };
    }
  }

  async getTaxpayerDetails(tin: string): Promise<LhdnResponse> {
    try {
      const response = await this.makeGatewayRequest(`/api/taxpayers/${tin}`);
      
      return {
        success: true,
        message: 'Taxpayer details retrieved successfully',
        data: response
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to get taxpayer details'
      };
    }
  }

  // Helper method to convert ERP invoice to LHDN format
  convertToLhdnFormat(erpInvoice: any): LhdnInvoiceData {
    return {
      invoiceNumber: erpInvoice.id,
      issueDate: erpInvoice.issueDate,
      dueDate: erpInvoice.dueDate,
      supplier: {
        tin: '', // Will be filled from config
        name: 'MulaERP Company', // From config
        address: 'Company Address', // From config
        email: 'company@example.com',
        phone: '+60123456789'
      },
      buyer: {
        name: erpInvoice.customer,
        address: 'Customer Address',
        email: 'customer@example.com',
        idType: 'NRIC',
        idValue: '123456789012'
      },
      items: erpInvoice.items?.map((item: any) => ({
        description: item.productName,
        quantity: item.quantity,
        unitPrice: item.price,
        totalAmount: item.total,
        taxType: 'SST',
        taxRate: 6,
        taxAmount: item.total * 0.06
      })) || [],
      totalAmount: erpInvoice.subtotal || erpInvoice.amount,
      totalTaxAmount: erpInvoice.taxAmount || 0,
      totalIncludingTax: erpInvoice.amount,
      currency: 'MYR',
      paymentMethod: 'Cash',
      notes: erpInvoice.notes
    };
  }
}

export default LhdnService;