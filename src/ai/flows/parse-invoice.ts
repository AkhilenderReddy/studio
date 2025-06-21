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
      "The invoice PDF, converted to an image and passed as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ParseInvoiceInput = z.infer<typeof ParseInvoiceInputSchema>;

const ParseInvoiceOutputSchema = z.object({
  extractedData: z.record(z.any()).nullable().describe('The extracted invoice data in JSON format.'),
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
