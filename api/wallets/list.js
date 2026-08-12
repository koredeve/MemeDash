/**
 * GET /api/wallets/list
 * Get all tracked wallets
 */

const { supabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }

  try {
    const { data: wallets, error } = await supabase
      .from("tracked_wallets")
      .select("*")
      .order("added_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      wallets: wallets || [],
      count: wallets?.length || 0,
    });
  } catch (error) {
    console.error("Wallet list error:", error);
    return res.status(500).json({ error: error.message });
  }
};
