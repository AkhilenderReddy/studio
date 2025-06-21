'use server';

/**
 * @fileOverview Invoice parsing flow using Gemini to extract data and present it in JSON format.
 *
 * - parseInvoice - A function that handles the invoice parsing process.
 * - ParseInvoiceInput - The input type for the parseInvoice function.
 * - ParseInvoiceOutput - The return type for the parseInvoice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ParseInvoiceInputSchema = z.object({
  invoiceDataUri: z
    .string()
    .describe(
      "The invoice PDF, converted to an image and passed as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
});
export type ParseInvoiceInput = z.infer<typeof ParseInvoiceInputSchema>;

const TaxItemSchema = z.object({
  tax_type: z.string().describe('The type of tax, e.g., SGST, CGST.'),
  tax_rate: z.number().describe('The tax rate percentage.'),
  tax_amount: z.number().describe('The calculated tax amount.'),
});

const InvoiceItemSchema = z.object({
  'sl.no': z.number().nullable().describe('The serial number of the item.'),
  hsn: z.string().nullable().describe('The Harmonized System of Nomenclature (HSN) code for the item.'),
  description: z.string().describe('A description of the invoice item.'),
  unit_price: z.number().describe('The price per unit of the item.'),
  qty: z.number().describe('The quantity of the item.'),
  net_amount: z.number().describe('The net amount for the item (quantity * unit price).'),
  tax: z.array(TaxItemSchema).describe('An array of taxes applied to the item.'),
  total_amount: z.number().describe('The total amount for the item including taxes.'),
});

const BankDetailsSchema = z.object({
  account_name: z.string().nullable().describe('The name on the bank account.'),
  account_number: z.string().nullable().describe('The bank account number.'),
  bank_name: z.string().nullable().describe('The name of the bank.'),
  branch: z.string().nullable().describe('The bank branch details.'),
  ifsc: z.string().nullable().describe('The IFSC code of the bank branch.'),
});

const ContactDetailsSchema = z.object({
  phone: z.string().nullable().describe('The contact phone number.'),
  email: z.string().nullable().describe('The contact email address.'),
});

const SellerSchema = z.object({
  name: z.string().describe('The name of the seller.'),
  gst: z.string().nullable().describe('The GST identification number of the seller.'),
  pan: z.string().nullable().describe('The Permanent Account Number (PAN) of the seller.'),
  address: z.string().nullable().describe('The full address of the seller.'),
  state: z.string().nullable().describe('The state of the seller.'),
  pincode: z.string().nullable().describe("The postal code of the seller's address."),
  country: z.string().nullable().describe('The country of the seller.'),
  bank_details: BankDetailsSchema.nullable().describe("The seller's bank account details."),
  contact_details: ContactDetailsSchema.nullable().describe("The seller's contact details."),
});

const BuyerSchema = z.object({
  name: z.string().describe('The name of the buyer.'),
  gst: z.string().nullable().describe('The GST identification number of the buyer.'),
  pan: z.string().nullable().describe('The Permanent Account Number (PAN) of the buyer.'),
  address: z.string().nullable().describe('The full address of the buyer.'),
  state: z.string().nullable().describe('The state of the buyer.'),
  pincode: z.string().nullable().describe("The postal code of the buyer's address."),
  country: z.string().nullable().describe('The country of the buyer.'),
  contact_details: ContactDetailsSchema.nullable().describe("The buyer's contact details."),
  billing_address: z.string().nullable().describe('The billing address for the buyer.'),
  shipping_address: z.string().nullable().describe('The shipping address for the buyer.'),
});

const ExtractedDataSchema = z.object({
  order_number: z.string().nullable().describe('The order number associated with the invoice.'),
  invoice_number: z.string().describe('The unique invoice number.'),
  order_date: z.string().nullable().describe('The date the order was placed (YYYY-MM-DD).'),
  invoice_id: z.string().nullable().describe('The invoice ID, often the same as the invoice number.'),
  invoice_date: z.string().describe('The date the invoice was issued (YYYY-MM-DD).'),
  seller: SellerSchema.describe('Details of the seller. This is a required object.'),
  buyer: BuyerSchema.describe('Details of the buyer. This is a required object.'),
  place_of_supply: z.string().nullable().describe('The place where the supply of goods or services occurred.'),
  place_of_delivery: z.string().nullable().describe('The place where the goods or services were delivered.'),
  invoice_items: z.array(InvoiceItemSchema).describe('A list of all items on the invoice. Must be an empty array if no items are found.'),
  transaction_id: z.string().nullable().describe('Any transaction ID associated with the payment.'),
  date_time: z.string().nullable().describe('The date and time of the invoice in ISO 8601 format.'),
  invoice_value: z.number().describe('The total value of the invoice.'),
  mode_of_payment: z.string().nullable().describe('The method of payment used or to be used.'),
});

const ParseInvoiceOutputSchema = z.object({
  extractedData: ExtractedDataSchema.nullable().describe('The extracted invoice data in JSON format.'),
});
export type ParseInvoiceOutput = z.infer<typeof ParseInvoiceOutputSchema>;

export async function parseInvoice(input: ParseInvoiceInput): Promise<ParseInvoiceOutput> {
  return parseInvoiceFlow(input);
}

const prompt = ai.definePrompt({
  name: 'parseInvoicePrompt',
  input: {schema: ParseInvoiceInputSchema},
  output: {schema: ParseInvoiceOutputSchema},
  prompt: `You are an expert invoice data extractor. Your task is to analyze the provided invoice image and extract all relevant information, presenting it as a single JSON object.

**Adhere strictly to the following JSON schema and field names.** If a field is not present in the invoice or is not applicable, set its value to \`null\`. For arrays (like \`invoice_items\` or \`tax\`), return an empty array \`[]\` if no items are found, rather than an array of \`null\` values. Do not add any extra fields beyond this schema.

**JSON Schema for Extraction:**

\`\`\`json
{
  "type": "OBJECT",
  "properties": {
    "order_number": {"type": "STRING", "nullable": true},
    "invoice_number": {"type": "STRING"},
    "order_date": {"type": "STRING", "nullable": true},
    "invoice_id": {"type": "STRING", "nullable": true},
    "invoice_date": {"type": "STRING"},
    "seller": {
      "type": ["OBJECT", "null"],
      "properties": {
        "name": {"type": "STRING"},
        "gst": {"type": "STRING", "nullable": true},
        "pan": {"type": "STRING", "nullable": true},
        "address": {"type": "STRING", "nullable": true},
        "state": {"type": "STRING", "nullable": true},
        "pincode": {"type": "STRING", "nullable": true},
        "country": {"type": "STRING", "nullable": true},
        "bank_details": {
          "type": ["OBJECT", "null"],
          "properties": {
            "account_name": {"type": "STRING", "nullable": true},
            "account_number": {"type": "STRING", "nullable": true},
            "bank_name": {"type": "STRING", "nullable": true},
            "branch": {"type": "STRING", "nullable": true},
            "ifsc": {"type": "STRING", "nullable": true}
          },
          "required": []
        },
        "contact_details": {
          "type": ["OBJECT", "null"],
          "properties": {
            "phone": {"type": "STRING", "nullable": true},
            "email": {"type": "STRING", "nullable": true}
          },
          "required": []
        }
      },
      "required": ["name"]
    },
    "buyer": {
      "type": ["OBJECT", "null"],
      "properties": {
        "name": {"type": "STRING"},
        "gst": {"type": "STRING", "nullable": true},
        "pan": {"type": "STRING", "nullable": true},
        "address": {"type": "STRING", "nullable": true},
        "state": {"type": "STRING", "nullable": true},
        "pincode": {"type": "STRING", "nullable": true},
        "country": {"type": "STRING", "nullable": true},
        "contact_details": {
          "type": ["OBJECT", "null"],
          "properties": {
            "email": {"type": "STRING", "nullable": true},
            "phone": {"type": "STRING", "nullable": true}
          },
          "required": []
        },
        "billing_address": {"type": "STRING", "nullable": true},
        "shipping_address": {"type": "STRING", "nullable": true}
      },
      "required": ["name"]
    },
    "place_of_supply": {"type": "STRING", "nullable": true},
    "place_of_delivery": {"type": "STRING", "nullable": true},
    "invoice_items": {
      "type": "ARRAY",
      "items": {
        "type": "OBJECT",
        "properties": {
          "sl.no": {"type": ["NUMBER", "null"]},
          "hsn": {"type": "STRING", "nullable": true},
          "description": {"type": "STRING"},
          "unit_price": {"type": "NUMBER"},
          "qty": {"type": "NUMBER"},
          "net_amount": {"type": "NUMBER"},
          "tax": {
            "type": "ARRAY",
            "items": {
              "type": "OBJECT",
              "properties": {
                "tax_type": {"type": "STRING"},
                "tax_rate": {"type": "NUMBER"},
                "tax_amount": {"type": "NUMBER"}
              },
              "required": ["tax_type", "tax_rate", "tax_amount"]
            }
          },
          "total_amount": {"type": "NUMBER"}
        },
        "required": ["description", "unit_price", "qty", "net_amount", "total_amount"]
      }
    },
    "transaction_id": {"type": "STRING", "nullable": true},
    "date_time": {"type": "STRING", "nullable": true},
    "invoice_value": {"type": "NUMBER"},
    "mode_of_payment": {"type": "STRING", "nullable": true}
  },
  "required": ["invoice_number", "invoice_date", "seller", "buyer", "invoice_items", "invoice_value"]
}
\`\`\`

**Key Extraction Guidelines:**

  * **Numerical Values:** Extract all amounts, prices, quantities, and rates as numbers (integers or floats).
  * **Dates:** Extract dates in 'YYYY-MM-DD' format. If time is present, \`date_time\` should follow ISO 8601 (e.g., 'YYYY-MM-DDTHH:MM:SS+HH:MM').
  * **Addresses:** Capture the full address as a single string.
  * **Tax Details:** For each \`invoice_item\`, include all tax components (type, rate, amount) as separate objects within the \`tax\` array. If an item has no tax, the \`tax\` array for that item should be empty (\`[]\`).
  * **Completeness:** Pay close attention to multi-line fields like addresses and descriptions, ensuring they are completely captured.
  * **Bank Details:** Extract all provided bank information accurately into the respective \`seller.bank_details\` fields.

The invoice to parse is attached.
{{media url=invoiceDataUri}}
`,
});

const parseInvoiceFlow = ai.defineFlow(
  {
    name: 'parseInvoiceFlow',
    inputSchema: ParseInvoiceInputSchema,
    outputSchema: ParseInvoiceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
