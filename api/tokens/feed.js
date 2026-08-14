/**
 * GET /api/tokens/feed
 * Get live token feed sorted by score and recency
 * Optional filters: status (clean|watch|avoid), limit, offset
 */

const { supabase } = require("../../lib/supabase");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET only" });
  }

  try {
    const { status, limit = 50, offset = 0 } = req.query;

    // Only show tokens from last 24 hours (prevents list from growing unbounded)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from("tokens")
      .select("*")
      .gte("detected_at", oneDayAgo)  // Only tokens detected in last 24 hours
      .order("detected_at", { ascending: false });

    // Filter by status if provided
    if (status && ["clean", "watch", "avoid", "neutral"].includes(status)) {
      query = query.eq("status", status);
    }

    // Apply pagination using range
    const limitInt = parseInt(limit);
    const offsetInt = parseInt(offset);
    const { data: tokens, error } = await query.range(offsetInt, offsetInt + limitInt - 1);

    if (error) throw error;

    // Compute derived metrics
    const stats = {
      total: tokens?.length || 0,
      clean: tokens?.filter((t) => t.status === "clean").length || 0,
      watch: tokens?.filter((t) => t.status === "watch").length || 0,
      avoid: tokens?.filter((t) => t.status === "avoid").length || 0,
      averageScore:
        tokens && tokens.length > 0
          ? Math.round(tokens.reduce((sum, t) => sum + (t.score || 0), 0) / tokens.length)
          : 0,
    };

    return res.status(200).json({
      success: true,
      tokens: tokens || [],
      stats,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: tokens?.length || 0,
      },
    });
  } catch (error) {
    console.error("Feed error:", error);
    return res.status(500).json({ error: error.message });
  }
};
