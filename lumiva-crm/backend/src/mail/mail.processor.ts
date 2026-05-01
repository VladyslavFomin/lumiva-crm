import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from './mail.service';
import { MAIL_QUEUE, MAIL_JOB_SEND } from './mail.constants';

@Processor(MAIL_QUEUE)
export class MailQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(MailQueueProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === MAIL_JOB_SEND) {
      this.logger.debug(`Processing mail job ${job.id} to: ${job.data.to}`);
      await this.mailService.sendMailDirect(job.data);
    }
  }
}
