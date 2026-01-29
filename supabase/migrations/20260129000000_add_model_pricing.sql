-- Model pricing configuration for cost calculation
-- Stores per-model pricing rates (cost per million tokens)

CREATE TABLE public.model_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT UNIQUE NOT NULL,
  input_cost_per_million DECIMAL(10, 6) NOT NULL,
  cached_input_cost_per_million DECIMAL(10, 6) NOT NULL,
  output_cost_per_million DECIMAL(10, 6) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by model name
CREATE INDEX model_pricing_model_name_idx ON public.model_pricing(model_name) WHERE is_active = true;

-- Enable RLS - pricing is public read
ALTER TABLE public.model_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active pricing" ON public.model_pricing
  FOR SELECT USING (is_active = true);

-- Seed pricing data (placeholder values - update with actual rates)
INSERT INTO public.model_pricing (model_name, input_cost_per_million, cached_input_cost_per_million, output_cost_per_million) VALUES
  ('gpt-5', 1.25, 0.125, 10.00),
  ('gpt-5-mini', 0.25, 0.025, 2.00),
  ('claude-sonnet-4-5-20250929', 3.00, 0.30, 15.00),
  ('claude-haiku-4-5-20251001', 1.00, 0.10, 5.00),
  ('z-ai/glm-4.6', 0.35, 0.00, 1.50);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_model_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER model_pricing_updated_at
  BEFORE UPDATE ON public.model_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_model_pricing_updated_at();
