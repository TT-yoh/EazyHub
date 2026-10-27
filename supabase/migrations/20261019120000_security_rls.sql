-- EazyHub row-level security baseline. Apply with: supabase db push (or run in SQL editor).

-- Helper: current user is any admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- admin_users: users can read own row; only super_admin can mutate
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_users_select_own_or_super" ON public.admin_users;
CREATE POLICY "admin_users_select_own_or_super"
  ON public.admin_users FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "admin_users_super_insert" ON public.admin_users;
CREATE POLICY "admin_users_super_insert"
  ON public.admin_users FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "admin_users_super_update" ON public.admin_users;
CREATE POLICY "admin_users_super_update"
  ON public.admin_users FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "admin_users_super_delete" ON public.admin_users;
CREATE POLICY "admin_users_super_delete"
  ON public.admin_users FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_select_own_or_admin" ON public.customers;
CREATE POLICY "customers_select_own_or_admin"
  ON public.customers FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "customers_insert_own" ON public.customers;
CREATE POLICY "customers_insert_own"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "customers_update_own_or_super" ON public.customers;
CREATE POLICY "customers_update_own_or_super"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR public.is_super_admin())
  WITH CHECK (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "customers_super_delete" ON public.customers;
CREATE POLICY "customers_super_delete"
  ON public.customers FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- products: read active catalog; admins manage
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_read_active" ON public.products;
CREATE POLICY "products_read_active"
  ON public.products FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "products_admin_write" ON public.products;
CREATE POLICY "products_admin_write"
  ON public.products FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_own_or_admin" ON public.orders;
CREATE POLICY "orders_select_own_or_admin"
  ON public.orders FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
CREATE POLICY "orders_insert_own"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (customer_id = auth.uid() AND NOT public.is_admin());

DROP POLICY IF EXISTS "orders_update_admin" ON public.orders;
CREATE POLICY "orders_update_admin"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (public.is_admin() OR (customer_id = auth.uid() AND payment_status = 'pending'))
  WITH CHECK (public.is_admin() OR customer_id = auth.uid());

DROP POLICY IF EXISTS "orders_no_client_delete" ON public.orders;
CREATE POLICY "orders_no_client_delete"
  ON public.orders FOR DELETE
  TO authenticated
  USING (public.is_super_admin());

-- order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select_via_order" ON public.order_items;
CREATE POLICY "order_items_select_via_order"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.customer_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "order_items_insert_own_pending_order" ON public.order_items;
CREATE POLICY "order_items_insert_own_pending_order"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.customer_id = auth.uid()
        AND o.payment_status = 'pending'
    )
  );

-- payments: read via order ownership; writes via service role / webhook only
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_via_order" ON public.payments;
CREATE POLICY "payments_select_via_order"
  ON public.payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payments.order_id
        AND (o.customer_id = auth.uid() OR public.is_admin())
    )
  );

-- app_settings: read for authenticated; write super_admin
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_read" ON public.app_settings;
CREATE POLICY "app_settings_read"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "app_settings_super_write" ON public.app_settings;
CREATE POLICY "app_settings_super_write"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_read" ON public.companies;
CREATE POLICY "companies_read"
  ON public.companies FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "companies_super_write" ON public.companies;
CREATE POLICY "companies_super_write"
  ON public.companies FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
