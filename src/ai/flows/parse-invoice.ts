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
  description: z.string().nullable().describe('A description of the invoice item.'),
  unit_price: z.number().nullable().describe('The price per unit of the item.'),
  qty: z.number().nullable().describe('The quantity of the item.'),
  net_amount: z.number().nullable().describe('The net amount for the item (quantity * unit price).'),
  tax: z.array(TaxItemSchema).nullable().describe('An array of taxes applied to the item.'),
  total_amount: z.number().nullable().describe('The total amount for the item including taxes.'),
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
  name: z.string().nullable().describe('The name of the seller.'),
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
  name: z.string().nullable().describe('The name of the buyer.'),
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
  invoice_number: z.string().nullable().describe('The unique invoice number.'),
  order_date: z.string().nullable().describe('The date the order was placed (YYYY-MM-DD).'),
  invoice_id: z.string().nullable().describe('The invoice ID, often the same as the invoice number.'),
  invoice_date: z.string().nullable().describe('The date the invoice was issued (YYYY-MM-DD).'),
  seller: SellerSchema.nullable().describe('Details of the seller.'),
  buyer: BuyerSchema.nullable().describe('Details of the buyer.'),
  place_of_supply: z.string().nullable().describe('The place where the supply of goods or services occurred.'),
  place_of_delivery: z.string().nullable().describe('The place where the goods or services were delivered.'),
  invoice_items: z.array(InvoiceItemSchema).nullable().describe('A list of all items on the invoice.'),
  transaction_id: z.string().nullable().describe('Any transaction ID associated with the payment.'),
  date_time: z.string().nullable().describe('The date and time of the invoice in ISO 8601 format.'),
  invoice_value: z.number().nullable().describe('The total value of the invoice.'),
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
  prompt: `Given the attached invoice image, extract the following information and present it in a JSON object. Adhere strictly to the provided JSON structure and field names. If a field is not found or applicable, set its value to 
  \`null\". Do not add any new fields.

Here is the desired JSON structure with example values:

\`json
{
  "order_number": null,
  "invoice_number": "24-25/Jan/8461",
  "order_date": null,
  "invoice_id": "24-25/Jan/8461",
  "invoice_date": "2025-02-11",
  "seller": {
    "name": "ASCENT HR TECHNOLOGIES PVT LTD",
    "gst": "29AAECA0163D1Z4",
    "pan": "AAECA0163D",
    "address": "MARUTHI CHAMBERS, 3RD FLOOR, SURVEY NO:17/4C, 9C, ROOPENA AGRAHARA, BANGALORE, 560068",
    "state": "KARNATAKA",
    "pincode": "560068",
    "country": null,
    "bank_details": {
      "account_name": "ASCENT HR TECHNOLOGIES PVT LTD",
      "account_number": "50200008759632",
      "bank_name": "HDFC BANK LTD",
      "branch": "Jayanagar branch, BANGALORE - 560 041",
      "ifsc": "HDFC0001226"
    },
    "contact_details": {
      "phone": null,
      "email": null
    }
  },
  "buyer": {
    "name": "OMNENEST TECHNOLOGIES PRIVATE LIMITED",
    "gst": "29AADCO9631P1ZN",
    "pan": null,
    "address": "Survey No 16/1 and 17/2, South Tower, Vaishnavi Tech Park, Ambalipura Village, Varthur Hobli, Bangalore East Taluk, BANGALORE, 560103",
    "state": "KARNATAKA",
    "pincode": "560103",
    "country": null,
    "contact_details": {
      "email": null,
      "phone": null
    },
    "billing_address": "Survey No 16/1 and 17/2, South Tower, Vaishnavi Tech Park, Ambalipura Village, Varthur Hobli, Bangalore East Taluk, BANGALORE, 560103",
    "shipping_address": "Survey No 16/1 and 17/2, South Tower, Vaishnavi Tech Park, Ambalipura Village, Varthur Hobli, Bangalore East Taluk, BANGALORE, 560103"
  },
  "place_of_supply": "BANGALORE, KARNATAKA - KA - 29",
  "place_of_delivery": null,
  "invoice_items": [
    {
      "sl.no": null,
      "hsn": "998216",
      "description": "Charges for compliance act under apprentice act for the period of Sep-24 to Dec-24 for 8 at Rs.5000 per establishment",
      "unit_price": 5000,
      "qty": 8,
      "net_amount": 40000,
      "tax": [
        {
          "tax_type": "SGST",
          "tax_rate": 9,
          "tax_amount": 3600
        },
        {
          "tax_type": "CGST",
          "tax_rate": 9,
          "tax_amount": 3600
        }
      ],
      "total_amount": 47200
    }
  ],
  "transaction_id": null,
  "date_time": "2025-02-11T16:39:10+05:30",
  "invoice_value": 47200,
  "mode_of_payment": null
}
\`

Ensure all numerical values are extracted as numbers (integers or floats) and not as strings. Dates should be in 'YYYY-MM-DD' format. If time is present, 
  \`date_time\` should follow ISO 8601 format. For addresses, capture the full address as a single string. For tax, extract each tax component (type, rate, amount) as a separate object within the \`tax\` array. If an item has no tax, the \`tax\` array should be empty.

Pay close attention to multi-line fields like addresses and descriptions, capturing them completely. For \`seller.bank_details\`, extract all provided bank information.

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
