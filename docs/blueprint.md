# **App Name**: InvoiceAI

## Core Features:

- Invoice Upload: Provides a drag-and-drop area for users to upload PDF invoice files, along with a 'Browse Files' button for local file selection. The name or thumbnail of the selected PDF will appear.
- JSON Display & Editing: A large, editable textarea displaying the target JSON structure for extracted invoice data. The extracted data will appear in this text area, so users can review and edit it before exporting or pushing to ERP.
- Parse & Push Button: Triggers the parsing process. Shows status indicators to provide real-time updates, such as uploading, extracting data, validating, and pushing to ERP.
- Invoice Parsing with Gemini: Processes the uploaded invoice using the Gemini LLM API to extract data into a JSON format based on the provided structure and instructions. Uses validation tools and provides notifications upon completion or failure.

## Style Guidelines:

- Primary color: Saturated blue (#3F51B5) to convey trust and efficiency.
- Background color: Light blue (#E8EAF6) for a clean, professional feel.
- Accent color: Analogous, darker purple (#5E35B1) to make key interactive elements such as buttons stand out.
- Headline font: 'Space Grotesk' sans-serif, suitable for headlines and short amounts of body text, which creates a techy scientific feel. Body text: 'Inter', sans-serif, with a neutral look.