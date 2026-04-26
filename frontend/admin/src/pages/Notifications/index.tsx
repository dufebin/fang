import React, { useState } from 'react'
import { Card, Form, Input, Button, message, Alert } from 'antd'
import { NotificationOutlined } from '@ant-design/icons'
import { broadcastNotification } from '../../api/user'

export default function NotificationsPage() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const onSend = async (values: { title: string; content: string }) => {
    setLoading(true)
    try {
      await broadcastNotification(values)
      message.success('广播通知已发送给所有用户')
      form.resetFields()
    } catch {
      // error shown by interceptor
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card
      title={<><NotificationOutlined /> 广播通知</>}
      style={{ maxWidth: 600 }}
    >
      <Alert
        message="广播通知将发送给所有注册用户，请谨慎使用"
        type="warning"
        showIcon
        style={{ marginBottom: 24 }}
      />
      <Form form={form} layout="vertical" onFinish={onSend}>
        <Form.Item name="title" label="通知标题" rules={[{ required: true, max: 50 }]}>
          <Input placeholder="请输入通知标题" />
        </Form.Item>
        <Form.Item name="content" label="通知内容" rules={[{ required: true, max: 500 }]}>
          <Input.TextArea rows={5} placeholder="请输入通知内容" showCount maxLength={500} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} icon={<NotificationOutlined />}>
            发送广播
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}
