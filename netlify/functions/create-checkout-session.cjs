const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { 
      amount, productName, orderId, successUrl, cancelUrl, customerEmail, 
      orderType // 'bid' or 'buyout'
    } = JSON.parse(event.body);

    // 1. 決定扣款模式：Bid = 凍結 (manual), Buyout = 即扣 (automatic)
    const captureMethod = orderType === 'bid' ? 'manual' : 'automatic';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'hkd',
          product_data: { name: productName },
          unit_amount: amount * 100,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: orderId,
      customer_email: customerEmail,
      
      // 2. 關鍵：將 orderType 放入 metadata，讓 Webhook 讀取
      payment_intent_data: {
        capture_method: captureMethod, 
        metadata: { orderType: orderType, orderId: orderId } 
      },
      metadata: {
          orderType: orderType,
          orderId: orderId
      }
    });

    return { statusCode: 200, body: JSON.stringify({ url: session.url }) };
  } catch (error) {
    console.error("Stripe Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};