import type { FastifyInstance } from 'fastify';
import { container } from 'tsyringe';
import { CompanyRepository } from '../repositories/company-repository.js';
import { UserRepository } from '../repositories/user-repository.js';
import { authGuard } from '../middleware/auth.js';
import { ForbiddenError, NotFoundError } from '../lib/errors.js';

/**
 * Registers company routes on the Fastify instance.
 *
 * @precondition The DI container must have CompanyRepository and UserRepository registered.
 * @postcondition Routes GET v1/companies/:id and PATCH v1/companies/:id are available.
 * PATCH requires the authenticated user to belong to the target company.
 * @param app - The Fastify application instance.
 */
export async function companyController(app: FastifyInstance): Promise<void> {
  const companyRepo = container.resolve<CompanyRepository>('CompanyRepository');
  const userRepo = container.resolve<UserRepository>('UserRepository');

  app.get<{ Params: { company_id: string } }>(
    '/v1/companies/:company_id',
    { preHandler: [authGuard] },
    async (request, reply) => {
      const company = await companyRepo.findWithRelations(Number(request.params.company_id));
      if (!company) throw new NotFoundError('Company not found');

      return reply.send({ company: formatCompany(company) });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { company: { name?: string; business_type?: string; website?: string; email?: string } };
  }>('/v1/companies/:id', { preHandler: [authGuard] }, async (request, reply) => {
    const id = Number(request.params.id);
    const user = await userRepo.findById(request.userId);
    if (user?.companyId !== id) throw new ForbiddenError('Not a member of this company');

    const { company } = request.body;

    const updated = await companyRepo.update(id, {
      name: company.name,
      businessType: company.business_type,
      website: company.website,
      email: company.email,
    });
    if (!updated) throw new NotFoundError('Company not found');

    const withRelations = await companyRepo.findWithRelations(id);
    return reply.send({ company: formatCompany(withRelations!) });
  });
}

function formatCompany(c: any) {
  return {
    id: c.id,
    name: c.name,
    business_type: c.businessType,
    website: c.website,
    email: c.email,
    addresses: c.addresses.map((a: any) => ({
      id: a.id,
      street_address: a.streetAddress,
      city: a.city,
      state: a.state,
      postal_code: a.postalCode,
      country: a.country,
      label: a.label,
    })),
    operation_hours: c.operationHours.map((h: any) => ({
      id: h.id,
      day_of_week: h.dayOfWeek,
      open_time: h.openTime,
      close_time: h.closeTime,
    })),
    phone_numbers: c.phoneNumbers.map((p: any) => ({
      id: p.id,
      phone_number_e164: p.phoneNumberE164,
      is_verified: p.isVerified,
      label: p.label,
    })),
    faqs: c.faqs.map((f: any) => ({
      id: f.id,
      question: f.question,
      answer: f.answer,
    })),
    offerings: c.offerings.map((o: any) => ({
      id: o.id,
      type: o.type,
      name: o.name,
      description: o.description,
      price_amount: o.priceAmount,
      price_currency: o.priceCurrency,
      price_frequency: o.priceFrequency,
    })),
  };
}
