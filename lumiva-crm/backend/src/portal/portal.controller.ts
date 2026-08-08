// src/portal/portal.controller.ts
import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PortalAuthGuard, type PortalRequestContact } from './portal-auth.guard';
import { PortalService } from './portal.service';
import { HelpdeskService } from '../helpdesk/helpdesk.service';

@Controller('portal')
export class PortalController {
  constructor(
    private readonly portal: PortalService,
    private readonly helpdesk: HelpdeskService,
  ) {}

  @Post('auth/request-link')
  requestLink(@Body() body: { clientKey: string; email: string }) {
    return this.portal.requestMagicLink(body.clientKey, body.email);
  }

  @Post('auth/verify')
  verify(@Body() body: { token: string }) {
    return this.portal.verifyMagicLink(body.token);
  }

  @Get('me')
  @UseGuards(PortalAuthGuard)
  me(@Req() req: any) {
    const contact = req.portalContact as PortalRequestContact;
    return this.portal.getMe(contact.contactId, contact.tenantId);
  }

  @Get('bookings')
  @UseGuards(PortalAuthGuard)
  bookings(@Req() req: any) {
    const contact = req.portalContact as PortalRequestContact;
    return this.portal.getBookings(contact.contactId, contact.tenantId);
  }

  @Get('orders')
  @UseGuards(PortalAuthGuard)
  orders(@Req() req: any) {
    const contact = req.portalContact as PortalRequestContact;
    return this.portal.getOrders(contact.contactId, contact.tenantId);
  }

  @Get('tickets')
  @UseGuards(PortalAuthGuard)
  tickets(@Req() req: any) {
    const contact = req.portalContact as PortalRequestContact;
    return this.helpdesk.listTicketsForContact(contact.tenantId, contact.contactId);
  }

  @Get('tickets/:id')
  @UseGuards(PortalAuthGuard)
  ticketDetail(@Req() req: any, @Param('id') id: string) {
    const contact = req.portalContact as PortalRequestContact;
    return this.helpdesk.getTicketForContact(contact.tenantId, contact.contactId, id);
  }

  @Post('tickets')
  @UseGuards(PortalAuthGuard)
  createTicket(@Req() req: any, @Body() body: { subject: string; message: string }) {
    const contact = req.portalContact as PortalRequestContact;
    return this.helpdesk.createTicketFromPortal(contact.tenantId, contact.contactId, body.subject, body.message);
  }

  @Post('tickets/:id/messages')
  @UseGuards(PortalAuthGuard)
  replyToTicket(@Req() req: any, @Param('id') id: string, @Body() body: { text: string }) {
    const contact = req.portalContact as PortalRequestContact;
    return this.helpdesk.addPortalMessage(contact.tenantId, contact.contactId, id, body.text);
  }
}
