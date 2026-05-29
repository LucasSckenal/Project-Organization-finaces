import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from '@google/generative-ai'
import { NextResponse } from 'next/server'
import { verifyRequest } from '@/lib/verifyAuth'

// ── Action tools the assistant can propose (executed client-side after confirm) ──
const TOOLS: FunctionDeclaration[] = [
  {
    name: 'add_transaction',
    description: 'Record a new income or expense transaction for the user.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        merchant: { type: SchemaType.STRING, description: 'Merchant or description, e.g. "Whole Foods"' },
        amount:   { type: SchemaType.NUMBER, description: 'Positive amount (no sign). e.g. 50' },
        type:     { type: SchemaType.STRING, format: 'enum', description: '"income" or "expense"', enum: ['income', 'expense'] },
        category: { type: SchemaType.STRING, description: 'Category like Groceries, Dining, Income, etc.' },
        date:     { type: SchemaType.STRING, description: 'ISO date YYYY-MM-DD. Omit for today.' },
        note:     { type: SchemaType.STRING, description: 'Optional note.' },
      },
      required: ['merchant', 'amount', 'type', 'category'],
    },
  },
  {
    name: 'add_goal',
    description: 'Create a new savings goal.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name:     { type: SchemaType.STRING },
        target:   { type: SchemaType.NUMBER, description: 'Target amount to reach' },
        current:  { type: SchemaType.NUMBER, description: 'Amount already saved. Omit for 0.' },
        deadline: { type: SchemaType.STRING, description: 'ISO date YYYY-MM-DD' },
        category: { type: SchemaType.STRING, format: 'enum', description: 'One of: Security, Travel, Wealth, Property', enum: ['Security', 'Travel', 'Wealth', 'Property'] },
      },
      required: ['name', 'target'],
    },
  },
  {
    name: 'set_budget',
    description: 'Set or update a monthly spending limit for a category.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        category: { type: SchemaType.STRING, description: 'Category like Groceries, Dining, etc.' },
        limit:    { type: SchemaType.NUMBER, description: 'Monthly limit amount' },
      },
      required: ['category', 'limit'],
    },
  },
]

// ── System prompt — injects user's real financial data ───────────────────────
function buildSystemPrompt(ctx: {
  name: string
  currency: string
  transactions: Array<{ date: string; merchant: string; category: string; amount: number; note?: string | null }>
  balances: { total: number; available: number; invested: number; savings: number } | null
  goals: Array<{ name: string; current: number; target: number; progress: number; deadline: string }>
}): string {
  const txLines = ctx.transactions
    .slice(0, 50)
    .map((t) => `  ${t.date} | ${t.merchant} | ${t.category} | ${t.amount > 0 ? '+' : ''}${t.amount}${t.note ? ` (${t.note})` : ''}`)
    .join('\n')

  const goalLines = ctx.goals.length
    ? ctx.goals.map((g) => `  ${g.name}: ${g.current}/${g.target} — ${g.progress}% (deadline: ${g.deadline})`).join('\n')
    : '  No goals set yet'

  const bal = ctx.balances
  const balLines = bal
    ? `  Net worth: ${ctx.currency} ${bal.total}\n  Available: ${ctx.currency} ${bal.available}\n  Invested:  ${ctx.currency} ${bal.invested}\n  Savings:   ${ctx.currency} ${bal.savings}`
    : '  No balance data'

  return `You are Ma, the AI assistant built into Ma Finance OS — a minimalist personal finance operating system.
Your personality: thoughtful, precise, direct. Like a knowledgeable friend who happens to be great with money.

USER: ${ctx.name}
CURRENCY: ${ctx.currency}

BALANCES:
${balLines}

RECENT TRANSACTIONS (newest first):
${txLines || '  No transactions yet'}

FINANCIAL GOALS:
${goalLines}

RULES:
- Be concise. Under 120 words unless the user asks for a breakdown.
- Always use real numbers from the data above. Never invent figures.
- Format amounts with the user's currency symbol.
- If data is insufficient to answer, say so honestly.
- When showing lists, use clean line breaks — no markdown headers.
- For time-based questions, calculate from the transaction dates above.
- Respond in the same language the user writes in.

ACTIONS:
- When the user asks to add/create/record a transaction, goal, or budget, call the matching function instead of replying with text.
- Only call a function when the user clearly intends to perform that action. For questions, just answer.
- The user will confirm the action before it is applied, so propose confidently.`
}

export async function POST(req: Request) {
  try {
    const authed = await verifyRequest(req)
    if (!authed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured. Add it to .env.local' },
        { status: 500 },
      )
    }

    const { messages, context } = await req.json()
    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model:             'gemini-2.0-flash',
      systemInstruction: buildSystemPrompt(context),
      tools:             [{ functionDeclarations: TOOLS }],
    })

    // Gemini uses 'user' / 'model' roles, history = everything except last message
    const history = messages.slice(0, -1).map(
      (m: { role: string; content: string }) => ({
        role:  m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }),
    )

    const chat    = model.startChat({ history })
    const lastMsg = messages[messages.length - 1].content

    const result = await chat.sendMessage(lastMsg)
    const calls  = result.response.functionCalls()

    // The model proposes one or more actions → client confirms & executes
    if (calls && calls.length > 0) {
      return NextResponse.json({
        type:    'action',
        actions: calls.map((c) => ({ name: c.name, args: c.args })),
        message: 'Here\'s what I\'ll do — confirm to apply:',
      })
    }

    // Plain answer
    return NextResponse.json({ type: 'text', text: result.response.text() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
