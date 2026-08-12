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

    let query = supabase
      .from("tokens")
      .select("*")
      .order("detected_at", { ascending: false });

    // Filter by status if provided
    if (status && ["clean", "watch", "avoid", "neutral"].includes(status)) {
      query = query.eq("status", status);
    }

    // Apply pagination
    const { data: tokens, error } = await query
      .limit(parseInt(limit))
      .offset(parseInt(offset));

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
