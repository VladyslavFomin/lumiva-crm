import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm'

@Entity('settings')
export class Setting {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ unique: true })
  key: string

  @Column({ type: 'text', nullable: true })
  value: string | null

  @Column({ nullable: true })
  label: string

  @Column({ nullable: true })
  group: string

  @UpdateDateColumn()
  updatedAt: Date
}
